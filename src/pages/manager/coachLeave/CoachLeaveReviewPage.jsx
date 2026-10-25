import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  listManagerCoachLeaveRequests,
  reviewCoachLeaveRequest,
} from '../../../services/coachLeaveService';
import { formatDateTime } from '../../../utils';

const STATUS = {
  PENDING: ['Chờ duyệt', 'warning'],
  APPROVED: ['Đã duyệt', 'success'],
  REJECTED: ['Từ chối', 'danger'],
  WITHDRAWN: ['Đã rút', 'secondary'],
};

function StatusBadge({ value }) {
  const [label, variant] = STATUS[value] || [value || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

function messageFor(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    COACH_LEAVE_NOT_PENDING: 'Yêu cầu này không còn ở trạng thái chờ duyệt.',
    COACH_LEAVE_NOT_FOUND: 'Không tìm thấy yêu cầu nghỉ.',
    COACH_LEAVE_HAS_AFFECTED_SESSIONS: 'Cần xử lý hết các buổi tập bị ảnh hưởng trước khi duyệt đơn nghỉ.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

export default function CoachLeaveReviewPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listManagerCoachLeaveRequests(status);
      setRows(result);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  function openDecision(row, action) {
    setActionError(null);
    setNote('');
    setDecision({ row, action });
  }

  async function submitDecision() {
    if (!decision) return;
    setBusy(true);
    setActionError(null);
    try {
      await reviewCoachLeaveRequest(decision.row.id, decision.action, note);
      setDecision(null);
      setNote('');
      setNotice(decision.action === 'approve' ? 'Đã duyệt yêu cầu nghỉ.' : 'Đã từ chối yêu cầu nghỉ.');
      await load();
    } catch (error) {
      setActionError(new Error(messageFor(error, 'Không thể cập nhật yêu cầu nghỉ.')));
    } finally {
      setBusy(false);
    }
  }

  const selectedCoach = decision?.row || null;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Yêu cầu nghỉ của huấn luyện viên</h1>
          <p className="text-muted mb-0">Duyệt đơn nghỉ và kiểm tra các buổi tập cần phân công hoặc dời lịch.</p>
        </div>
        <div className="d-flex gap-2">
          <Form.Select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="WITHDRAWN">Đã rút</option>
          </Form.Select>
          <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
        </div>
      </div>

      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {actionError ? <ErrorAlert error={actionError} title="Không thể xử lý yêu cầu" onClose={() => setActionError(null)} /> : null}
      {loadError ? <ErrorAlert error={loadError} title="Không tải được yêu cầu nghỉ" /> : null}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          {loading ? <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div> : !rows.length ? (
            <p className="text-muted mb-0">Không có yêu cầu phù hợp.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead><tr><th>Huấn luyện viên</th><th>Ngày gửi</th><th>Thời gian nghỉ</th><th>Lý do</th><th>Buổi bị ảnh hưởng</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
                <tbody>{rows.map((row) => {
                  return (
                    <tr key={row.id}>
                      <td><Link className="fw-semibold text-decoration-none" to={`/manager/staff-accounts/${row.coachId}`}>{row.coachFullName || 'Huấn luyện viên'}</Link><div className="small text-muted">{row.coachPhone || '—'}</div></td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{formatDateTime(row.startTime)}<br /><span className="text-muted">đến {formatDateTime(row.endTime)}</span></td>
                      <td style={{ minWidth: 180 }}>{row.reason}{row.reviewNote ? <div className="small text-muted mt-1">Phản hồi: {row.reviewNote}</div> : null}</td>
                      <td>
                        {!row.affectedSessionIds?.length ? '0' : (
                          <div className="d-flex flex-wrap gap-1">
                            {row.affectedSessionIds.map((id, index) => <Button key={id} as={Link} to={`/manager/class-sessions/${id}`} size="sm" variant="outline-secondary">Buổi {index + 1}</Button>)}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge value={row.status} /></td>
                      <td className="text-end">{row.status === 'PENDING' ? <div className="d-flex justify-content-end gap-2"><Button size="sm" variant="outline-success" disabled={Boolean(row.affectedSessionIds?.length)} title={row.affectedSessionIds?.length ? 'Hãy xử lý hết các buổi tập bị ảnh hưởng trước.' : undefined} onClick={() => openDecision(row, 'approve')}>Duyệt</Button><Button size="sm" variant="outline-danger" onClick={() => openDecision(row, 'reject')}>Từ chối</Button></div> : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={Boolean(decision)} onHide={() => !busy && setDecision(null)} centered backdrop="static">
        <Modal.Header closeButton={!busy}><Modal.Title className="h5">{decision?.action === 'approve' ? 'Duyệt yêu cầu nghỉ' : 'Từ chối yêu cầu nghỉ'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>Xác nhận {decision?.action === 'approve' ? 'duyệt' : 'từ chối'} yêu cầu của <strong>{selectedCoach?.coachFullName || 'huấn luyện viên này'}</strong>?</p>
          {decision?.action === 'approve' && decision?.row.affectedSessionIds?.length ? <Alert variant="warning" className="small">Có {decision.row.affectedSessionIds.length} buổi tập bị ảnh hưởng. Hãy phân công lại hoặc dời lịch toàn bộ trước khi duyệt.</Alert> : null}
          <Form.Group>
            <Form.Label>Ghi chú phản hồi</Form.Label>
            <Form.Control as="textarea" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDecision(null)} disabled={busy}>Quay lại</Button>
          <Button variant={decision?.action === 'approve' ? 'success' : 'danger'} onClick={submitDecision} disabled={busy}>{busy ? 'Đang xử lý...' : 'Xác nhận'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
