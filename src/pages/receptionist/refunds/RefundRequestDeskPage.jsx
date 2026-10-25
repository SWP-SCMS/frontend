import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  createReceptionRefundRequest,
  listReceptionRefundRequests,
  listRefundEligibleSources,
  recordRefundCashDisbursement,
} from '../../../services/refundService';
import { formatDateTime, formatPrice } from '../../../utils';

const PAGE_SIZE = 20;

const STATUS = {
  REQUESTED: ['Chờ duyệt bước đầu', 'warning'],
  FIRST_APPROVED: ['Chờ chi tiền mặt', 'info'],
  CASH_DISBURSED: ['Đã chi tiền, chờ xác nhận', 'primary'],
  COMPLETED: ['Đã hoàn tất', 'success'],
  REJECTED: ['Đã từ chối', 'danger'],
  CANCELLED: ['Đã hủy', 'secondary'],
};

const TYPE = {
  TERMINATED_MEMBERSHIP: 'Gói đã chấm dứt',
  RESERVED_CANCELLATION: 'Hủy gói đặt trước',
};

const EMPTY_PAGE = {
  content: [],
  page: 0,
  totalElements: 0,
  totalPages: 0,
};

function statusBadge(status) {
  const [label, variant] = STATUS[status] || [status || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

function messageOf(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    REFUND_NOT_FOUND: 'Yêu cầu hoàn tiền không còn tồn tại.',
    REFUND_NOT_ELIGIBLE: 'Thanh toán hoặc gói tập không đủ điều kiện hoàn tiền.',
    REFUND_ALREADY_EXISTS: 'Thanh toán này đã có yêu cầu hoàn tiền đang mở.',
    REFUND_AMOUNT_EXCEEDS_LIMIT: 'Số tiền yêu cầu vượt mức hoàn tối đa.',
    REFUND_INVALID_TRANSITION: 'Yêu cầu không còn ở trạng thái cho phép thao tác này.',
    REFUND_REQUEST_CHANGED: 'Yêu cầu đã được người khác cập nhật. Hãy tải lại.',
    REFUND_PAYMENT_METHOD_UNSUPPORTED: 'Chỉ thanh toán tiền mặt mới được hoàn theo luồng này.',
    REFUND_REMAINING_DAYS_BELOW_THRESHOLD: 'Thời gian còn lại của gói thấp hơn ngưỡng được hoàn tiền.',
    VALIDATION_ERROR: 'Dữ liệu hoàn tiền chưa hợp lệ.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

export default function RefundRequestDeskPage() {
  const [result, setResult] = useState(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceCandidates, setSourceCandidates] = useState([]);
  const [cashTarget, setCashTarget] = useState(null);
  const [evidence, setEvidence] = useState('');
  const idempotencyKey = useRef(newIdempotencyKey());
  const [form, setForm] = useState({
    memberCode: '',
    paymentId: '',
    membershipId: '',
    requestedAmount: '',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listReceptionRefundRequests({ page, size: PAGE_SIZE }));
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không tải được danh sách hoàn tiền.')));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'memberCode') setSourceCandidates([]);
  }

  async function findRefundSources() {
    const memberCode = form.memberCode.trim().toUpperCase();
    if (!/^MB-[0-9]+$/.test(memberCode)) {
      setError(new Error('Nhập mã hội viên dạng MB-100001 trước khi tìm nguồn hoàn.'));
      return;
    }
    setSourceLoading(true);
    setError(null);
    try {
      const candidates = await listRefundEligibleSources(memberCode);
      setSourceCandidates(candidates);
      if (candidates.length === 1) selectRefundSource(candidates[0]);
      if (!candidates.length) {
        setError(new Error('Hội viên hiện không có nguồn hoàn tiền đủ điều kiện.'));
      }
    } catch (requestError) {
      setSourceCandidates([]);
      setError(new Error(messageOf(requestError, 'Không tải được nguồn hoàn tiền đủ điều kiện.')));
    } finally {
      setSourceLoading(false);
    }
  }

  function selectRefundSource(candidate) {
    setForm((current) => ({
      ...current,
      memberCode: current.memberCode.trim().toUpperCase(),
      paymentId: candidate.paymentId,
      membershipId: candidate.membershipId,
      requestedAmount: String(candidate.suggestedAmount || ''),
    }));
  }

  async function createRequest(event) {
    event.preventDefault();
    const memberCode = form.memberCode.trim().toUpperCase();
    const paymentId = form.paymentId.trim();
    const membershipId = form.membershipId.trim();
    const amountText = form.requestedAmount.trim();
    const reason = form.reason.trim();

    if (!/^MB-[0-9]+$/.test(memberCode)) {
      setError(new Error('Mã hội viên phải có dạng MB-100001.'));
      return;
    }
    if (!paymentId || !membershipId) {
      setError(new Error('Vui lòng chọn một nguồn hoàn tiền đủ điều kiện.'));
      return;
    }
    if (!/^[1-9][0-9]*$/.test(amountText)) {
      setError(new Error('Số tiền yêu cầu phải là số nguyên lớn hơn 0.'));
      return;
    }
    if (!reason) {
      setError(new Error('Vui lòng nhập lý do hoàn tiền.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createReceptionRefundRequest(memberCode, {
        paymentId,
        membershipId,
        requestedAmount: Number(amountText),
        reason,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = newIdempotencyKey();
      setForm({ memberCode: '', paymentId: '', membershipId: '', requestedAmount: '', reason: '' });
      setSourceCandidates([]);
      setNotice('Đã gửi yêu cầu hoàn tiền để Quản lý duyệt bước đầu.');
      if (page === 0) await load();
      else setPage(0);
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể tạo yêu cầu hoàn tiền.')));
    } finally {
      setSubmitting(false);
    }
  }

  function openCash(row) {
    setEvidence('');
    setError(null);
    setCashTarget(row);
  }

  async function confirmCash() {
    const normalizedEvidence = evidence.trim();
    if (!normalizedEvidence) {
      setError(new Error('Vui lòng nhập bằng chứng đã giao tiền mặt.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await recordRefundCashDisbursement(cashTarget.id, {
        expectedVersion: cashTarget.version,
        evidence: normalizedEvidence,
      });
      setCashTarget(null);
      setEvidence('');
      setNotice('Đã ghi nhận giao tiền mặt. Yêu cầu đang chờ Quản lý xác nhận hoàn tất.');
      await load();
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể ghi nhận giao tiền mặt.')));
    } finally {
      setSubmitting(false);
    }
  }

  const rows = result.content || [];

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Hoàn tiền gói tập</h1>
          <p className="text-muted mb-0">Tạo yêu cầu hoàn tiền mặt và ghi nhận việc giao tiền sau khi được duyệt.</p>
        </div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
      </div>

      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {error ? <ErrorAlert error={error} title="Không thể xử lý hoàn tiền" onClose={() => setError(null)} /> : null}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <h2 className="h5 fw-bold">Tạo yêu cầu hoàn tiền</h2>
          <Form onSubmit={createRequest} className="row g-3">
            <Form.Group className="col-lg-3">
              <Form.Label>Mã hội viên *</Form.Label>
              <div className="d-flex gap-2">
                <Form.Control value={form.memberCode} onChange={(event) => updateForm('memberCode', event.target.value)} placeholder="MB-100001" maxLength={20} />
                <Button type="button" variant="outline-danger" disabled={sourceLoading} onClick={findRefundSources}>{sourceLoading ? 'Đang tìm...' : 'Tìm nguồn'}</Button>
              </div>
            </Form.Group>
            {sourceCandidates.length ? (
              <Form.Group className="col-12">
                <Form.Label>Nguồn hoàn tiền đủ điều kiện</Form.Label>
                <Form.Select
                  value={form.paymentId && form.membershipId ? `${form.paymentId}|${form.membershipId}` : ''}
                  onChange={(event) => {
                    const candidate = sourceCandidates.find((item) => `${item.paymentId}|${item.membershipId}` === event.target.value);
                    if (candidate) selectRefundSource(candidate);
                  }}
                >
                  <option value="">Chọn thanh toán và gói tập</option>
                  {sourceCandidates.map((candidate) => (
                    <option key={`${candidate.paymentId}-${candidate.membershipId}`} value={`${candidate.paymentId}|${candidate.membershipId}`}>
                      {candidate.receiptNumber} · {candidate.offerName} · {TYPE[candidate.type] || candidate.type} · đề xuất {formatPrice(candidate.suggestedAmount, candidate.currency || 'VND')}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">Nguồn và mức đề xuất được backend tính tại thời điểm tra cứu; hệ thống sẽ kiểm tra lại khi gửi.</Form.Text>
              </Form.Group>
            ) : null}
            <Form.Group className="col-lg-3">
              <Form.Label>Số tiền yêu cầu *</Form.Label>
              <Form.Control type="number" min="1" step="1" inputMode="numeric" value={form.requestedAmount} onChange={(event) => updateForm('requestedAmount', event.target.value)} />
            </Form.Group>
            <Form.Group className="col-lg-6">
              <Form.Label>Lý do *</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={1000} value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} />
            </Form.Group>
            <div className="col-lg-3 d-flex align-items-end">
              <Button type="submit" variant="danger" className="w-100" disabled={submitting}>
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu hoàn tiền'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <h2 className="h5 fw-bold mb-3">Danh sách yêu cầu</h2>
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
          ) : rows.length === 0 ? (
            <p className="text-muted mb-0">Chưa có yêu cầu hoàn tiền.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead><tr><th>Ngày gửi</th><th>Hội viên</th><th>Nguồn hoàn</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.requestedAt)}</td>
                    <td><div className="fw-semibold">{row.memberFullName || 'Hội viên'}</div><div className="small text-muted">{row.memberCode || '—'}</div></td>
                    <td><div>{row.receiptNumber || 'Chưa có số biên lai'}</div><div className="small text-muted">Đơn {row.orderNumber || '—'}</div></td>
                    <td>{TYPE[row.type] || row.type || '—'}</td>
                    <td>
                      <div>Yêu cầu: <strong>{formatPrice(row.requestedAmount, 'VND')}</strong></div>
                      <div className="small text-muted">Đề xuất: {formatPrice(row.suggestedAmount, 'VND')}</div>
                      {row.approvedAmount != null ? <div className="small text-success">Được duyệt: {formatPrice(row.approvedAmount, 'VND')}</div> : null}
                    </td>
                    <td>{statusBadge(row.status)}</td>
                    <td className="text-end">
                      {row.status === 'FIRST_APPROVED' ? <Button size="sm" variant="outline-danger" onClick={() => openCash(row)}>Ghi nhận chi tiền</Button> : '—'}
                    </td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        {result.totalPages > 1 ? (
          <Card.Footer className="bg-white d-flex justify-content-between align-items-center">
            <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
            <span className="small text-muted">Trang {page + 1}/{result.totalPages} · {result.totalElements} yêu cầu</span>
            <Button size="sm" variant="outline-secondary" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
          </Card.Footer>
        ) : null}
      </Card>

      <Modal show={Boolean(cashTarget)} onHide={() => !submitting && setCashTarget(null)} centered backdrop="static">
        <Modal.Header closeButton={!submitting}><Modal.Title className="h5">Xác nhận giao tiền hoàn</Modal.Title></Modal.Header>
        <Modal.Body>
          <dl className="row small">
            <dt className="col-5">Hội viên</dt><dd className="col-7">{cashTarget?.memberFullName || 'Hội viên'}<div className="small text-muted">{cashTarget?.memberCode || '—'}</div></dd>
            <dt className="col-5">Nguồn hoàn</dt><dd className="col-7">{cashTarget?.receiptNumber || '—'}<div className="small text-muted">Đơn {cashTarget?.orderNumber || '—'}</div></dd>
            <dt className="col-5">Số tiền được duyệt</dt><dd className="col-7 fw-bold text-danger">{formatPrice(cashTarget?.approvedAmount, 'VND')}</dd>
          </dl>
          <Alert variant="warning" className="small">Chỉ xác nhận sau khi đã giao đủ tiền mặt cho hội viên. Quản lý vẫn phải xác nhận bước cuối.</Alert>
          <Form.Group>
            <Form.Label>Bằng chứng giao tiền *</Form.Label>
            <Form.Control as="textarea" rows={3} maxLength={2000} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Ví dụ: Hội viên đã ký nhận tiền tại quầy, phiếu chi số..." />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={submitting} onClick={() => setCashTarget(null)}>Quay lại</Button>
          <Button variant="danger" disabled={submitting || !evidence.trim()} onClick={confirmCash}>{submitting ? 'Đang xử lý...' : 'Xác nhận đã giao tiền'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
