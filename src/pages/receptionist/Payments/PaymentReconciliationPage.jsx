// Receptionist / Manager – Manual Payment Reconciliation (US19).
//
// The screen is a worklist of PENDING payments plus a two-outcome decision
// form (confirm PAID, or mark FAILED once the window has lapsed).
//
// Business rules this page is built around:
//   - BR-PAY-12 — a PENDING Bank Transfer may be manually reconciled even
//     before the 24h window ends. So "expired" is NOT a precondition for
//     confirming PAID.
//   - BR-PAY-17 / BR-PAY-08 — moving PENDING -> FAILED, and flipping the
//     Order to EXPIRED, is only allowed AFTER the window expires. The BE
//     enforces this with 409 "Payment window has not expired"; we surface
//     the button as disabled until then so the operator is not baited into
//     a guaranteed failure.
//   - BR-VAL-COM-05 / BR-PAY-13 — a manual PAID is only valid when the real
//     transaction matches the Order, amount and transfer content, and the
//     provider reference / reconciliation evidence must be recorded.
//   - BR-PAY-16 — PAID and FAILED are terminal. Nothing here re-opens a
//     settled payment; the queue only lists PENDING.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import {
  QUEUE_FILTER,
  RECONCILE_STATUS,
  getPaymentResult,
  listReconciliationQueue,
  reconcilePayment,
} from '../../../services/paymentReconciliationService';
import { formatDateTime, formatPrice } from '../../../utils';

const PAGE_SIZE = 20;

const QUEUE_FILTERS = [
  { value: QUEUE_FILTER.ALL, label: 'Tất cả' },
  { value: QUEUE_FILTER.PENDING, label: 'Còn trong hạn' },
  { value: QUEUE_FILTER.EXPIRED_WINDOW, label: 'Quá hạn' },
];

// Both outcomes demand a reason and evidence (BE rejects the call with 400
// otherwise). PAID additionally demands the three match-verification
// fields, per BR-VAL-COM-05.
const REASON_MIN = 5;
const EVIDENCE_MIN = 5;

const EMPTY_QUEUE = {
  content: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

function readNumberParam(params, name, fallback) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

// A payment can only be moved to FAILED once its window has lapsed
// (BR-PAY-17). `expiresAt` null means the BE has no window, which the
// migration V7 explicitly allows for some Orders — treat that as "not yet
// eligible" rather than "expired", so we never send a call the BE will 409.
function isWindowExpired(item) {
  if (!item?.expiresAt) return false;
  const expiry = new Date(item.expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= Date.now();
}

export default function PaymentReconciliationPage() {
  const [queue, setQueue] = useState(EMPTY_QUEUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState(QUEUE_FILTER.ALL);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);

  // Decision modal state.
  const [active, setActive] = useState(null);
  const [outcome, setOutcome] = useState(RECONCILE_STATUS.PAID);
  const [form, setForm] = useState({
    receivedAmount: '',
    transferContent: '',
    providerTransactionId: '',
    evidence: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Canonical post-reconcile state (Membership / Receipt ids), fetched only
  // AFTER a successful action so the banner proves the outcome landed.
  const [result, setResult] = useState(null);
  const [resultError, setResultError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReconciliationQueue({
        status: filter,
        query,
        page,
        size: PAGE_SIZE,
      });
      setQueue({ ...EMPTY_QUEUE, ...data });
    } catch (err) {
      setError(err);
      setQueue(EMPTY_QUEUE);
    } finally {
      setLoading(false);
    }
  }, [filter, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSubmitSearch(e) {
    e.preventDefault();
    setPage(0);
    setQuery(searchInput.trim());
  }

  function handleFilterChange(next) {
    setFilter(next);
    setPage(0);
  }

  function openDecision(item, target) {
    setActive(item);
    setOutcome(target);
    setSubmitError(null);
    setResult(null);
    setResultError(null);
    setForm({
      // Pre-fill the amount the BE will compare against so the operator
      // confirms the real figure instead of retyping it. It is still
      // editable: a mismatch is exactly the signal BR-VAL-COM-05 wants
      // the operator to act on, so we must not silently force it.
      receivedAmount: String(item?.amount ?? ''),
      transferContent: item?.transferContent ?? '',
      providerTransactionId: '',
      evidence: '',
      reason: '',
    });
  }

  function closeDecision() {
    if (submitting) return;
    setActive(null);
    setSubmitError(null);
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const isPaid = outcome === RECONCILE_STATUS.PAID;

  const validationMessage = useMemo(() => {
    if (!active) return null;
    if (form.reason.trim().length < REASON_MIN) {
      return `Lý do phải có ít nhất ${REASON_MIN} ký tự.`;
    }
    if (form.evidence.trim().length < EVIDENCE_MIN) {
      return `Bằng chứng đối soát phải có ít nhất ${EVIDENCE_MIN} ký tự.`;
    }
    if (isPaid) {
      if (form.receivedAmount.trim() === '') {
        return 'Cần nhập số tiền thực nhận.';
      }
      if (!Number.isFinite(Number(form.receivedAmount))) {
        return 'Số tiền thực nhận không hợp lệ.';
      }
      if (!form.transferContent.trim()) {
        return 'Cần nhập nội dung chuyển khoản để đối chiếu.';
      }
      if (!form.providerTransactionId.trim()) {
        return 'Cần nhập mã giao dịch / reference từ ngân hàng hoặc provider.';
      }
    }
    return null;
  }, [active, form, isPaid]);

  async function handleConfirm() {
    if (!active || validationMessage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        status: outcome,
        evidence: form.evidence.trim(),
        reason: form.reason.trim(),
      };
      if (isPaid) {
        payload.receivedAmount = Number(form.receivedAmount);
        payload.transferContent = form.transferContent.trim();
        payload.providerTransactionId = form.providerTransactionId.trim();
      }
      await reconcilePayment(active.paymentId, payload);
      // The queue only lists PENDING, so the settled row disappears on
      // reload — that is the correct confirmation the action landed.
      await load();
      // Re-read canonical state so the operator can hand over the
      // Membership / Receipt identifiers (BR-PAY-15: exactly one each).
      try {
        const data = await getPaymentResult(active.paymentId);
        setResult(data);
        setResultError(null);
      } catch (err) {
        setResultError(err);
      }
      setActive(null);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const rows = queue.content ?? [];
  const totalPages = Math.max(1, queue.totalPages || 1);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          title="Không có giao dịch cần đối soát"
          message="Mọi giao dịch Bank Transfer đã được xử lý hoặc chưa phát sinh."
        />
      );
    }
    return (
      <Table hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Mã giao dịch</th>
            <th>Đơn / Hội viên</th>
            <th>Số tiền</th>
            <th>Nội dung CK</th>
            <th>Hạn thanh toán</th>
            <th className="text-end">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expired = isWindowExpired(row);
            return (
              <tr key={row.paymentId}>
                <td>
                  <code className="small">{row.paymentId}</code>
                </td>
                <td>
                  <div className="fw-semibold">
                    {row.memberName || row.memberAccountId || '—'}
                  </div>
                  <div className="text-muted small">
                    {row.orderNumber || row.orderId}
                  </div>
                </td>
                <td>{formatPrice(row.amount, row.currencyCode || 'VND')}</td>
                <td>
                  <code className="small">{row.transferContent || '—'}</code>
                </td>
                <td>
                  {row.expiresAt ? (
                    <>
                      <div>{formatDateTime(row.expiresAt)}</div>
                      <span
                        className={`badge ${
                          expired
                            ? 'bg-secondary-subtle text-secondary-emphasis'
                            : 'bg-warning-subtle text-warning-emphasis'
                        }`}
                      >
                        {expired ? 'Đã quá hạn' : 'Còn trong hạn'}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted small">Không có hạn</span>
                  )}
                </td>
                <td className="text-end">
                  <ButtonGroup size="sm">
                    <Button
                      variant="outline-success"
                      onClick={() => openDecision(row, RECONCILE_STATUS.PAID)}
                    >
                      Xác nhận đã CK
                    </Button>
                    <Button
                      variant="outline-danger"
                      // BR-PAY-17: FAILED is only legal after the window
                      // lapses. Disabled with a tooltip so the rule is
                      // visible instead of producing a 409.
                      disabled={!expired}
                      title={
                        expired
                          ? 'Đánh dấu không có giao dịch hợp lệ'
                          : 'Chỉ đánh dấu FAILED sau khi hết hạn thanh toán 24 giờ'
                      }
                      onClick={() => openDecision(row, RECONCILE_STATUS.FAILED)}
                    >
                      Không hợp lệ
                    </Button>
                  </ButtonGroup>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows]);

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Đối soát thanh toán</h1>
        <p className="text-muted mb-0">
          Xác nhận hoặc bác giao dịch chuyển khoản thủ công khi chưa có kết
          quả từ ngân hàng / SePay (US19).
        </p>
      </header>

      <Alert variant="info" className="small">
        Mỗi thao tác đối soát đều ghi vào Audit log gồm người thực hiện,
        thời điểm, lý do và bằng chứng đối soát. Giao dịch đã ở trạng
        thái <strong>PAID</strong> hoặc <strong>FAILED</strong> là trạng
        thái cuối và không thể sửa lại.
      </Alert>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <Form onSubmit={handleSubmitSearch} style={{ maxWidth: 360, flexGrow: 1 }}>
          <InputGroup size="sm">
            <Form.Control
              type="search"
              placeholder="Tìm theo mã đơn, mã giao dịch, họ tên…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Tìm kiếm giao dịch cần đối soát"
            />
            <Button type="submit" variant="outline-danger">
              Tìm
            </Button>
          </InputGroup>
        </Form>

        <div>
          <div className="text-muted small mb-1">Trạng thái hạn</div>
          <ButtonGroup size="sm">
            {QUEUE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'danger' : 'outline-danger'}
                onClick={() => handleFilterChange(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <ErrorAlert
        error={error}
        title="Không tải được danh sách đối soát"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">{tableBody}</div>
        {rows.length > 0 ? (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
            <small className="text-muted">
              Trang {page + 1} / {totalPages} · Tổng {queue.totalElements} giao
              dịch
            </small>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canPrev || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← Trang trước
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau →
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ---------- Decision modal ---------- */}
      <Modal show={Boolean(active)} onHide={closeDecision} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isPaid ? 'Xác nhận đã chuyển khoản' : 'Đánh dấu không hợp lệ'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {active ? (
            <>
              <dl className="row small mb-3">
                <dt className="col-sm-3 text-muted fw-normal">Mã giao dịch</dt>
                <dd className="col-sm-9 mb-1">
                  <code>{active.paymentId}</code>
                </dd>
                <dt className="col-sm-3 text-muted fw-normal">Hội viên</dt>
                <dd className="col-sm-9 mb-1">
                  {active.memberName || active.memberAccountId || '—'}
                </dd>
                <dt className="col-sm-3 text-muted fw-normal">Đơn</dt>
                <dd className="col-sm-9 mb-1">
                  {active.orderNumber || active.orderId}
                </dd>
                <dt className="col-sm-3 text-muted fw-normal">Số tiền</dt>
                <dd className="col-sm-9 mb-0">
                  {formatPrice(active.amount, active.currencyCode || 'VND')}
                </dd>
              </dl>

              {!isPaid ? (
                <Alert variant="warning" className="small">
                  Đánh dấu <strong>FAILED</strong> sẽ chuyển Payment sang
                  FAILED và Order sang <strong>EXPIRED</strong>. Thao tác này
                  không thể hoàn tác.
                </Alert>
              ) : null}

              <ErrorAlert
                error={submitError}
                title="Không thực hiện được"
                onClose={() => setSubmitError(null)}
              />

              <Row className="g-3">
                {isPaid ? (
                  <>
                    <Col md={4}>
                      <Form.Group controlId="rec-amount">
                        <Form.Label className="small mb-1">
                          Số tiền thực nhận
                        </Form.Label>
                        <Form.Control
                          type="number"
                          inputMode="numeric"
                          value={form.receivedAmount}
                          onChange={(e) =>
                            updateField('receivedAmount', e.target.value)
                          }
                          required
                        />
                        <Form.Text className="text-muted">
                          Phải khớp đúng số tiền của đơn.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={8}>
                      <Form.Group controlId="rec-provider">
                        <Form.Label className="small mb-1">
                          Mã giao dịch / reference
                        </Form.Label>
                        <Form.Control
                          value={form.providerTransactionId}
                          onChange={(e) =>
                            updateField('providerTransactionId', e.target.value)
                          }
                          placeholder="Ví dụ: FT25092ABC123"
                          required
                        />
                        <Form.Text className="text-muted">
                          Lấy từ sao kê ngân hàng hoặc SePay. Mỗi mã chỉ được
                          dùng cho một Payment.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group controlId="rec-content">
                        <Form.Label className="small mb-1">
                          Nội dung chuyển khoản
                        </Form.Label>
                        <Form.Control
                          value={form.transferContent}
                          onChange={(e) =>
                            updateField('transferContent', e.target.value)
                          }
                          required
                        />
                        <Form.Text className="text-muted">
                          Phải khớp <strong>chính xác</strong> nội dung hệ
                          thống yêu cầu — hệ thống so sánh tuyệt đối.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </>
                ) : null}

                <Col md={12}>
                  <Form.Group controlId="rec-evidence">
                    <Form.Label className="small mb-1">
                      Bằng chứng đối soát
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={form.evidence}
                      onChange={(e) => updateField('evidence', e.target.value)}
                      placeholder="Ví dụ: Ảnh chụp báo cáo tài khoản ngày 04/10, số dư khớp."
                      required
                    />
                    <Form.Text className="text-muted">
                      Mô tả nguồn đối chiếu: ảnh sao kê, báo cáo ngân hàng,
                      mã giao dịch, thời điểm kiểm tra.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group controlId="rec-reason">
                    <Form.Label className="small mb-1">
                      Lý do quyết định
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={form.reason}
                      onChange={(e) => updateField('reason', e.target.value)}
                      placeholder="Ví dụ: Đã đối chiếu sao kê ngân hàng, tiền đã vào tài khoản."
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>

              {validationMessage ? (
                <Alert variant="warning" className="small mb-0 mt-3">
                  {validationMessage}
                </Alert>
              ) : null}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={closeDecision}
            disabled={submitting}
          >
            Huỷ
          </Button>
          <Button
            variant={isPaid ? 'success' : 'danger'}
            onClick={handleConfirm}
            disabled={Boolean(validationMessage) || submitting}
          >
            {submitting
              ? 'Đang xử lý…'
              : isPaid
                ? 'Xác nhận PAID'
                : 'Đánh dấu FAILED'}
          </Button>
        </Modal.Footer>
      </Modal>

      {resultError ? (
        <div className="mt-3">
          <ErrorAlert
            error={resultError}
            title="Không đọi được trạng thái giao dịch"
            onClose={() => setResultError(null)}
          />
        </div>
      ) : null}
      {result ? (
        <div className="mt-3">
          <Alert variant="success" className="small mb-0">
            Trạng thái hiện tại: <strong>{result.status}</strong>
            {result.membershipId ? (
              <>
                {' '}
                · Membership: <code>{result.membershipId}</code>
              </>
            ) : null}
            {result.receiptId ? (
              <>
                {' '}
                ·{' '}
                {/* The reconciliation response carries only the receipt UUID,
                    but the backend now lets a receptionist read a
                    bank-transfer receipt too, so this is a receipt the user is
                    entitled to see. Link it instead of leaving a dead id. */}
                <Link to={`/receipts/${result.receiptId}`}>
                  Xem &amp; in biên lai
                </Link>
              </>
            ) : null}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}