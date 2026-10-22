import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getMemberAccount } from '../../../services/memberAccountService';
import {
  createManagerDirectTermination,
  decideFreezeRequest,
  decideTerminationRequest,
  listManagerFreezeRequests,
  listManagerTerminationRequests,
} from '../../../services/membershipRequestService';
import { formatDate, formatDateTime, formatPrice } from '../../../utils';

const LABELS = {
  PENDING: ['Chờ duyệt', 'warning'],
  APPROVED: ['Đã duyệt', 'info'],
  EXECUTED: ['Đã chấm dứt', 'secondary'],
  REJECTED: ['Từ chối', 'danger'],
  WITHDRAWN: ['Đã rút', 'secondary'],
  OBSOLETE: ['Không còn hiệu lực', 'secondary'],
  APPROVED_PENDING_PAYMENT: ['Chờ thu phí', 'info'],
  SCHEDULED: ['Đã lên lịch', 'success'],
};

function statusBadge(status) {
  const [label, variant] = LABELS[status] || [status || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

function errorMessage(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    MEMBERSHIP_TERMINATION_CHANGED: 'Yêu cầu đã được người khác cập nhật. Hãy tải lại.',
    MEMBERSHIP_FREEZE_CHANGED: 'Yêu cầu đã được người khác cập nhật. Hãy tải lại.',
    MEMBERSHIP_TERMINATION_INVALID_TRANSITION: 'Yêu cầu hủy không còn chờ duyệt.',
    MEMBERSHIP_FREEZE_INVALID_TRANSITION: 'Yêu cầu đóng băng không còn chờ duyệt.',
    MEMBERSHIP_FREEZE_INVALID_PERIOD: 'Khoảng đóng băng không còn hợp lệ.',
    MEMBERSHIP_NOT_ACTIVE: 'Gói tập của hội viên không còn hoạt động.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

export default function MembershipRequestReviewPage() {
  const [terminationRows, setTerminationRows] = useState([]);
  const [freezeRows, setFreezeRows] = useState([]);
  const [memberSummaries, setMemberSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [direct, setDirect] = useState({ memberAccountId: '', mode: 'END_OF_CYCLE', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [terminations, freezes] = await Promise.all([
        listManagerTerminationRequests(),
        listManagerFreezeRequests(),
      ]);
      setTerminationRows(terminations.content || []);
      setFreezeRows(freezes.content || []);
      const ids = [...new Set([
        ...(terminations.content || []).map((row) => row.memberAccountId),
        ...(freezes.content || []).map((row) => row.memberAccountId),
      ].filter(Boolean))];
      const summaries = await Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await getMemberAccount(id)];
          } catch {
            return [id, null];
          }
        }),
      );
      setMemberSummaries(Object.fromEntries(summaries));
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDecision(kind, action, row) {
    setActionError(null);
    setDecision({ kind, action, row });
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    setActionError(null);
    try {
      const payload = { expectedVersion: decision.row.version };
      if (decision.kind === 'termination') {
        await decideTerminationRequest(decision.row.id, decision.action, payload);
      } else {
        await decideFreezeRequest(decision.row.id, decision.action, payload);
      }
      setDecision(null);
      setNotice(decision.action === 'approve' ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.');
      await load();
    } catch (error) {
      setActionError(new Error(errorMessage(error, 'Không thể cập nhật yêu cầu.')));
    } finally {
      setBusy(false);
    }
  }

  async function submitDirect(event) {
    event.preventDefault();
    if (!direct.memberAccountId.trim() || !direct.reason.trim()) {
      setActionError(new Error('Vui lòng nhập Account ID và lý do.'));
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await createManagerDirectTermination(direct.memberAccountId.trim(), {
        mode: direct.mode,
        reason: direct.reason.trim(),
      });
      setDirect({ memberAccountId: '', mode: 'END_OF_CYCLE', reason: '' });
      setNotice('Đã tạo và duyệt yêu cầu hủy gói trực tiếp.');
      await load();
    } catch (error) {
      setActionError(new Error(errorMessage(error, 'Không thể hủy gói trực tiếp.')));
    } finally {
      setBusy(false);
    }
  }

  const decisionMember = decision
    ? memberSummaries[decision.row.memberAccountId]
    : null;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Yêu cầu gói tập</h1>
          <p className="text-muted mb-0">Duyệt yêu cầu hủy và đóng băng gói tập của hội viên.</p>
        </div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
      </div>
      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {actionError ? <ErrorAlert error={actionError} title="Không thể xử lý yêu cầu" onClose={() => setActionError(null)} /> : null}
      {loadError ? <ErrorAlert error={loadError} title="Không tải được danh sách yêu cầu" /> : null}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <h2 className="h5 fw-bold">Hủy trực tiếp theo quyết định quản lý</h2>
          <p className="small text-muted">Dùng Account ID của hội viên. Thao tác này tạo và duyệt yêu cầu trong cùng một lần.</p>
          <Form onSubmit={submitDirect} className="row g-3 align-items-end">
            <Form.Group className="col-lg-4">
              <Form.Label>Member Account ID</Form.Label>
              <Form.Control value={direct.memberAccountId} onChange={(event) => setDirect((value) => ({ ...value, memberAccountId: event.target.value }))} />
            </Form.Group>
            <Form.Group className="col-lg-2">
              <Form.Label>Thời điểm hủy</Form.Label>
              <Form.Select value={direct.mode} onChange={(event) => setDirect((value) => ({ ...value, mode: event.target.value }))}>
                <option value="END_OF_CYCLE">Cuối chu kỳ</option>
                <option value="IMMEDIATE">Ngay lập tức</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="col-lg-4">
              <Form.Label>Lý do</Form.Label>
              <Form.Control maxLength={1000} value={direct.reason} onChange={(event) => setDirect((value) => ({ ...value, reason: event.target.value }))} />
            </Form.Group>
            <div className="col-lg-2"><Button type="submit" variant="danger" className="w-100" disabled={busy}>Xác nhận hủy</Button></div>
          </Form>
        </Card.Body>
      </Card>

      {loading ? <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div> : (
        <>
          <ReviewTable title="Yêu cầu hủy gói" kind="termination" rows={terminationRows} memberSummaries={memberSummaries} onDecision={openDecision} />
          <ReviewTable title="Yêu cầu đóng băng" kind="freeze" rows={freezeRows} memberSummaries={memberSummaries} onDecision={openDecision} />
        </>
      )}

      <Modal show={Boolean(decision)} onHide={() => !busy && setDecision(null)} centered backdrop="static">
        <Modal.Header closeButton={!busy}>
          <Modal.Title className="h5">{decision?.action === 'approve' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Xác nhận {decision?.action === 'approve' ? 'duyệt' : 'từ chối'} yêu cầu của hội viên{' '}
            <strong>{decisionMember?.fullName || 'Không tải được tên'}</strong>?
          </p>
          <div className="small text-muted mb-3">
            {decisionMember?.memberId || 'Chưa có mã hội viên'}
            {decision?.row.memberAccountId ? ` · ${decision.row.memberAccountId}` : ''}
          </div>
          {decision?.kind === 'freeze' && decision?.action === 'approve' ? (
            <Alert variant="info" className="small mt-3 mb-0">Sau khi duyệt, hệ thống tính phí; lễ tân phải thu phí để lịch đóng băng có hiệu lực.</Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDecision(null)} disabled={busy}>Quay lại</Button>
          <Button variant={decision?.action === 'approve' ? 'success' : 'danger'} onClick={submitDecision} disabled={busy}>
            {busy ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function ReviewTable({ title, kind, rows, memberSummaries, onDecision }) {
  const termination = kind === 'termination';
  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Body className="p-4">
        <h2 className="h5 fw-bold mb-3">{title}</h2>
        {!rows.length ? <p className="text-muted mb-0">Chưa có yêu cầu.</p> : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead><tr><th>Hội viên</th><th>Ngày gửi</th><th>Nội dung</th><th>Lý do</th>{!termination ? <th>Phí</th> : null}<th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
              <tbody>{rows.map((row) => {
                const member = memberSummaries[row.memberAccountId];
                return (
                <tr key={row.id}>
                  <td>
                    <Link to={`/manager/members/${row.memberAccountId}`} className="fw-semibold text-decoration-none">
                      {member?.fullName || 'Không tải được tên'}
                    </Link>
                    <div className="small text-muted">{member?.memberId || row.memberAccountId}</div>
                  </td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{termination ? row.mode === 'IMMEDIATE' ? 'Hủy ngay' : 'Cuối chu kỳ' : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`}</td>
                  <td style={{ minWidth: 180 }}>{row.reason}</td>
                  {!termination ? <td>{row.feeAmount == null ? '—' : formatPrice(row.feeAmount, 'VND')}</td> : null}
                  <td>{statusBadge(row.status)}</td>
                  <td className="text-end">
                    {row.status === 'PENDING' ? <div className="d-flex justify-content-end gap-2"><Button size="sm" variant="outline-success" onClick={() => onDecision(kind, 'approve', row)}>Duyệt</Button><Button size="sm" variant="outline-danger" onClick={() => onDecision(kind, 'reject', row)}>Từ chối</Button></div> : '—'}
                  </td>
                </tr>
              );})}</tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
