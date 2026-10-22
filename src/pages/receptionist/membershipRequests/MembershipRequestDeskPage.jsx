import { useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { searchReceptionMember } from '../../../services/receptionistService';
import {
  collectFreezeCashPayment,
  createReceptionFreezeRequest,
  createReceptionTerminationRequest,
  listReceptionFreezeRequests,
  listReceptionTerminationRequests,
} from '../../../services/membershipRequestService';
import { formatDate, formatDateTime, formatPrice, normalizePhone } from '../../../utils';

const STATUS_LABELS = {
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
  const [label, variant] = STATUS_LABELS[status] || [status || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

function messageOf(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    MEMBERSHIP_NOT_ACTIVE: 'Hội viên không có gói tập đang hoạt động.',
    MEMBERSHIP_TERMINATION_ALREADY_PENDING: 'Hội viên đã có yêu cầu hủy gói đang chờ.',
    MEMBERSHIP_FREEZE_ALREADY_PENDING: 'Hội viên đã có yêu cầu đóng băng đang mở.',
    MEMBERSHIP_FREEZE_INVALID_PERIOD: 'Khoảng thời gian đóng băng không hợp lệ.',
    MEMBERSHIP_FREEZE_PAYMENT_REQUIRED: 'Yêu cầu chưa ở trạng thái được phép thu phí.',
    MEMBERSHIP_FREEZE_CHANGED: 'Yêu cầu đã thay đổi. Hãy tải lại trước khi thu phí.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

function todayInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function MembershipRequestDeskPage() {
  const [criterion, setCriterion] = useState('memberId');
  const [memberCodeInput, setMemberCodeInput] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [terminationRows, setTerminationRows] = useState([]);
  const [freezeRows, setFreezeRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [termination, setTermination] = useState({ mode: 'END_OF_CYCLE', reason: '' });
  const [freeze, setFreeze] = useState({ startDate: '', endDate: '', reason: '' });

  async function loadFor(code) {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError(new Error('Vui lòng nhập mã hội viên.'));
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [terminations, freezes] = await Promise.all([
        listReceptionTerminationRequests(normalized),
        listReceptionFreezeRequests(normalized),
      ]);
      setMemberCode(normalized);
      setTerminationRows(terminations.content || []);
      setFreezeRows(freezes.content || []);
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không tìm thấy hoặc không tải được hội viên.')));
      setMemberCode('');
      setTerminationRows([]);
      setFreezeRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function lookup(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const raw = memberCodeInput.trim();
    const phone = criterion === 'phone' ? normalizePhone(raw) : null;
    if (criterion === 'phone' && !phone) {
      setError(new Error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'));
      return;
    }
    if (criterion === 'memberId' && !raw) {
      setError(new Error('Vui lòng nhập mã hội viên.'));
      return;
    }
    setLoading(true);
    try {
      const member = await searchReceptionMember(
        criterion === 'phone' ? { phone } : { memberId: raw.toUpperCase() },
      );
      setSelectedMember(member);
      await loadFor(member.memberId);
    } catch (requestError) {
      setSelectedMember(null);
      setMemberCode('');
      setTerminationRows([]);
      setFreezeRows([]);
      setError(new Error(messageOf(requestError, 'Không tìm thấy hội viên.')));
      setLoading(false);
    }
  }

  async function createTermination(event) {
    event.preventDefault();
    if (!termination.reason.trim()) return setError(new Error('Vui lòng nhập lý do hủy gói.'));
    setBusy(true); setError(null); setNotice(null);
    try {
      await createReceptionTerminationRequest(memberCode, { mode: termination.mode, reason: termination.reason.trim() });
      setTermination({ mode: 'END_OF_CYCLE', reason: '' });
      setNotice('Đã tạo yêu cầu hủy gói cho hội viên.');
      await loadFor(memberCode);
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể tạo yêu cầu hủy gói.')));
    } finally { setBusy(false); }
  }

  async function createFreeze(event) {
    event.preventDefault();
    if (!freeze.startDate || !freeze.endDate || freeze.endDate <= freeze.startDate) return setError(new Error('Ngày kết thúc phải sau ngày bắt đầu.'));
    if (!freeze.reason.trim()) return setError(new Error('Vui lòng nhập lý do đóng băng.'));
    setBusy(true); setError(null); setNotice(null);
    try {
      await createReceptionFreezeRequest(memberCode, { ...freeze, reason: freeze.reason.trim() });
      setFreeze({ startDate: '', endDate: '', reason: '' });
      setNotice('Đã tạo yêu cầu đóng băng cho hội viên.');
      await loadFor(memberCode);
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể tạo yêu cầu đóng băng.')));
    } finally { setBusy(false); }
  }

  async function collectPayment() {
    if (!paymentTarget) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const receipt = await collectFreezeCashPayment(paymentTarget.id, paymentTarget.version);
      setPaymentTarget(null);
      setNotice(`Đã thu ${formatPrice(receipt.amount, receipt.currencyCode)}. Mã thanh toán: ${receipt.paymentId}`);
      await loadFor(memberCode);
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể ghi nhận thanh toán phí đóng băng.')));
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Yêu cầu gói tập</h1>
      <p className="text-muted mb-4">Tạo yêu cầu hộ hội viên và thu phí đóng băng đã được duyệt.</p>
      <Card className="border-0 shadow-sm mb-4"><Card.Body className="p-4">
        <Form onSubmit={lookup} className="d-flex flex-wrap align-items-end gap-3">
          <Form.Group>
            <Form.Label>Tra cứu theo</Form.Label>
            <div className="btn-group d-flex" role="group" aria-label="Tiêu chí tra cứu hội viên">
              <Button type="button" variant={criterion === 'memberId' ? 'danger' : 'outline-danger'} onClick={() => { setCriterion('memberId'); setMemberCodeInput(''); setSelectedMember(null); setMemberCode(''); }}>Mã hội viên</Button>
              <Button type="button" variant={criterion === 'phone' ? 'danger' : 'outline-danger'} onClick={() => { setCriterion('phone'); setMemberCodeInput(''); setSelectedMember(null); setMemberCode(''); }}>Số điện thoại</Button>
            </div>
          </Form.Group>
          <Form.Group style={{ minWidth: 280 }}>
            <Form.Label>{criterion === 'phone' ? 'Số điện thoại' : 'Mã hội viên'}</Form.Label>
            <Form.Control
              value={memberCodeInput}
              onChange={(event) => setMemberCodeInput(event.target.value)}
              placeholder={criterion === 'phone' ? 'VD: 0901234567' : 'VD: MB-100001'}
              inputMode={criterion === 'phone' ? 'numeric' : undefined}
            />
          </Form.Group>
          <Button type="submit" variant="danger" disabled={loading}>{loading ? 'Đang tìm...' : 'Tra cứu yêu cầu'}</Button>
        </Form>
        {selectedMember && memberCode ? (
          <div className="mt-3 pt-3 border-top">
            <strong>{selectedMember.fullName || '—'}</strong>
            <span className="text-muted"> · {selectedMember.memberId} · {selectedMember.phone || 'Không có SĐT'}</span>
          </div>
        ) : null}
      </Card.Body></Card>

      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {error ? <ErrorAlert error={error} title="Không thể xử lý" onClose={() => setError(null)} /> : null}
      {loading ? <div className="py-5 text-center"><Spinner animation="border" variant="danger" /></div> : null}

      {memberCode && !loading ? <>
        <Card className="border-0 shadow-sm mb-4"><Card.Body className="p-4">
          <h2 className="h5 fw-bold">Tạo yêu cầu hủy gói — {memberCode}</h2>
          <Form onSubmit={createTermination} className="row g-3 align-items-end">
            <Form.Group className="col-lg-3"><Form.Label>Thời điểm hủy</Form.Label><Form.Select value={termination.mode} onChange={(event) => setTermination((value) => ({ ...value, mode: event.target.value }))}><option value="END_OF_CYCLE">Cuối chu kỳ</option><option value="IMMEDIATE">Ngay sau khi duyệt</option></Form.Select></Form.Group>
            <Form.Group className="col-lg-6"><Form.Label>Lý do</Form.Label><Form.Control maxLength={1000} value={termination.reason} onChange={(event) => setTermination((value) => ({ ...value, reason: event.target.value }))} /></Form.Group>
            <div className="col-lg-3"><Button className="w-100" type="submit" variant="danger" disabled={busy}>Tạo yêu cầu hộ</Button></div>
          </Form>
          <RequestTable kind="termination" rows={terminationRows} />
        </Card.Body></Card>

        <Card className="border-0 shadow-sm mb-4"><Card.Body className="p-4">
          <h2 className="h5 fw-bold">Tạo yêu cầu đóng băng — {memberCode}</h2>
          <Form onSubmit={createFreeze} className="row g-3 align-items-end">
            <Form.Group className="col-lg-2"><Form.Label>Từ ngày</Form.Label><Form.Control type="date" min={todayInput()} value={freeze.startDate} onChange={(event) => setFreeze((value) => ({ ...value, startDate: event.target.value }))} /></Form.Group>
            <Form.Group className="col-lg-2"><Form.Label>Đến ngày</Form.Label><Form.Control type="date" min={freeze.startDate || todayInput()} value={freeze.endDate} onChange={(event) => setFreeze((value) => ({ ...value, endDate: event.target.value }))} /></Form.Group>
            <Form.Group className="col-lg-5"><Form.Label>Lý do</Form.Label><Form.Control maxLength={1000} value={freeze.reason} onChange={(event) => setFreeze((value) => ({ ...value, reason: event.target.value }))} /></Form.Group>
            <div className="col-lg-3"><Button className="w-100" type="submit" variant="danger" disabled={busy}>Tạo yêu cầu hộ</Button></div>
          </Form>
          <RequestTable kind="freeze" rows={freezeRows} onPayment={setPaymentTarget} />
        </Card.Body></Card>
      </> : null}

      <Modal show={Boolean(paymentTarget)} onHide={() => !busy && setPaymentTarget(null)} centered backdrop="static">
        <Modal.Header closeButton={!busy}><Modal.Title className="h5">Thu phí đóng băng</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>Xác nhận đã nhận tiền mặt từ hội viên?</p>
          <dl className="row mb-0"><dt className="col-5">Thời gian đóng băng</dt><dd className="col-7">{formatDate(paymentTarget?.startDate)} – {formatDate(paymentTarget?.endDate)}</dd><dt className="col-5">Số tiền</dt><dd className="col-7 fw-bold text-danger">{formatPrice(paymentTarget?.feeAmount, 'VND')}</dd></dl>
          <Alert variant="warning" className="small mb-0">Chỉ xác nhận sau khi đã nhận đủ tiền mặt. Thao tác sẽ lên lịch đóng băng ngay.</Alert>
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" disabled={busy} onClick={() => setPaymentTarget(null)}>Quay lại</Button><Button variant="danger" disabled={busy} onClick={collectPayment}>{busy ? 'Đang ghi nhận...' : 'Xác nhận đã thu tiền'}</Button></Modal.Footer>
      </Modal>
    </div>
  );
}

function RequestTable({ kind, rows, onPayment }) {
  const termination = kind === 'termination';
  if (!rows.length) return <p className="small text-muted mt-4 mb-0">Chưa có yêu cầu.</p>;
  return <div className="table-responsive mt-4"><Table hover className="align-middle mb-0"><thead><tr><th>Ngày gửi</th><th>Nội dung</th><th>Lý do</th>{!termination ? <th>Phí</th> : null}<th>Trạng thái</th>{!termination ? <th className="text-end">Thanh toán</th> : null}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDateTime(row.createdAt)}</td><td>{termination ? row.mode === 'IMMEDIATE' ? 'Hủy ngay' : 'Cuối chu kỳ' : `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`}</td><td>{row.reason}</td>{!termination ? <td>{row.feeAmount == null ? '—' : formatPrice(row.feeAmount, 'VND')}</td> : null}<td>{statusBadge(row.status)}</td>{!termination ? <td className="text-end">{row.status === 'APPROVED_PENDING_PAYMENT' ? <Button size="sm" variant="outline-danger" onClick={() => onPayment(row)}>Thu tiền mặt</Button> : '—'}</td> : null}</tr>)}</tbody></Table></div>;
}
