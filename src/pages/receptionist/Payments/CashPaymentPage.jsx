// Receptionist – Collect a cash payment at the front desk (US20).
//
// BE: POST /api/v1/reception/members/{memberId}/cash-payments
//       body: { offerId }
//     -> 201 PaymentResultResponse
//        { paymentId, orderId, status, method, membershipId, receiptId, paidAt }
//
// Contract details that shape this UI:
//   - ONE call does everything. The backend creates the Order, the Payment,
//     the Membership and the Receipt inside a single transaction, so there
//     is no "create order then confirm" sequence to orchestrate here. The
//     body is only { offerId }.
//   - There is deliberately NO "payment method" field on the order-create
//     request. The backend rejects unknown fields outright, and the older
//     POST /reception/membership-orders/{orderId}/cash endpoint is
//     deprecated and always throws. Cash is its own endpoint, not an option
//     on the bank-transfer one — see PaymentController.
//   - The Offer is snapshotted by the backend at payment time. We display
//     the returned identifiers and never re-read the live Offer afterwards,
//     so the receipt can't drift from what was actually sold.
//   - Four 409 preconditions are BUSINESS outcomes, not bugs:
//       member not ACTIVE, member already has an ACTIVE membership,
//       member already has a PENDING_PAYMENT order, offer not ACTIVE.
//     Each gets its own message, because "already paid" and "offer
//     unavailable" need different handling at the counter.
//   - Cash is immediate and terminal. Unlike bank transfer there is no
//     payment window and nothing to reconcile later, so this page has no
//     expiry logic at all.
//
// Flow: this page is reachable from the sidebar with NO member selected, so it
// owns the lookup itself (US11 search) instead of bouncing the user to the
// member list. The `?memberId=` deep link from a member profile is still
// honoured for the "Thu tiền mặt" button on that page.

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
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
import {
  cancelMembershipOrder,
  createReceptionCashPayment,
  getReceptionPendingOrder,
  searchReceptionMember,
} from '../../../services/receptionistService';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice, normalizePhone } from '../../../utils';
import './ReceiptPage.css';

// Business 409s from the backend, mapped to counter-ready wording.
const CONFLICT_MESSAGES = {
  ACTIVE_MEMBERSHIP_EXISTS:
    'Hội viên đang có gói tập còn hiệu lực, không cần mua thêm.',
  PENDING_MEMBERSHIP_ORDER_EXISTS:
    'Hội viên đang có đơn chưa thanh toán. Vui lòng xử lý đơn đó trước.',
  MEMBER_NOT_ACTIVE:
    'Tài khoản hội viên không ở trạng thái ACTIVE nên không thể thu tiền.',
  MEMBER_NOT_FOUND: 'Không tìm thấy hội viên.',
  OFFER_NOT_ACTIVE: 'Gói tập đã ngừng bán, vui lòng chọn gói khác.',
};

const MEMBER_STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  SUSPENDED: 'Đã tạm khóa',
  INACTIVE: 'Ngừng hoạt động',
};

export default function CashPaymentPage() {
  const [params, setParams] = useSearchParams();
  const memberId = params.get('memberId') || '';

  // ---- Lookup state (US11) ----
  // The backend takes EXACTLY one of memberId|phone, and the lookup is an
  // exact match (no name/email/partial), so this is a radio + text field
  // rather than a single free-text search box.
  const [criterion, setCriterion] = useState('memberId');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // ---- Member + offer state ----
  const [member, setMember] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offerId, setOfferId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  // PaymentResultResponse KHÔNG trả về tên gói hay số tiền (chỉ có
  // paymentId, orderId, status, method, membershipId, receiptId, paidAt).
  // Nên giữ lại thông tin offer lúc bấm xác nhận, trước khi clear lựa chọn.
  const [purchased, setPurchased] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);

  // ---- Cancel-a-stuck-order state (PATCH /membership-orders/{id}/cancel) ----
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Offers are role-shared (RECEPTIONIST may read them) and never change
  // while the receptionist is at the counter, so load them once.
  useEffect(() => {
    let cancelled = false;
    listActiveOffers()
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the member whenever the deep-linked memberId changes (or clears).
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setMember(null);
    setPendingOrder(null);
    setReceipt(null);
    setPurchased(null);
    setOfferId('');

    if (!memberId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    Promise.all([
      searchReceptionMember({ memberId }),
      getReceptionPendingOrder(memberId).catch(() => null),
    ])
      .then(([found, pending]) => {
        if (cancelled) return;
        setMember(found);
        setPendingOrder(pending);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const selectedOffer = useMemo(
    () => offers.find((o) => o.offerId === offerId) || null,
    [offers, offerId],
  );

  const memberStatus = member?.status;
  const isSuspended = Boolean(member) && memberStatus !== 'ACTIVE';
  const blockedByPendingOrder = Boolean(pendingOrder);

  // Resolve the lookup to a memberId, then deep-link with ?memberId=.
  // Looking up by phone needs a round trip first, because the cash endpoint
  // is keyed by memberId and the URL carries that key.
  function handleLookupSubmit(e) {
    e.preventDefault();
    setSearchError(null);

    if (criterion === 'memberId') {
      const id = memberIdInput.trim();
      if (!id) {
        setSearchError(new Error('Vui lòng nhập mã hội viên.'));
        return;
      }
      setParams(new URLSearchParams({ memberId: id }), { replace: true });
      return;
    }

    const phone = normalizePhone(phoneInput);
    if (!phone) {
      setSearchError(new Error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'));
      return;
    }
    setSearching(true);
    searchReceptionMember({ phone })
      .then((found) => {
        setParams(new URLSearchParams({ memberId: found.memberId }), {
          replace: true,
        });
      })
      .catch((err) => setSearchError(err))
      .finally(() => setSearching(false));
  }

  function handleClearMember() {
    setParams(new URLSearchParams(), { replace: true });
    setMemberIdInput('');
    setPhoneInput('');
    setSearchError(null);
    setMember(null);
    setReceipt(null);
    setPurchased(null);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!offerId) {
      setError(new Error('Vui lòng chọn một gói tập.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createReceptionCashPayment(memberId, { offerId });
      setReceipt(result);
      setPurchased(selectedOffer);
      setPendingOrder(null);
      setOfferId('');
      // The member now holds an ACTIVE membership, so any further attempt is a
      // guaranteed 409. Refresh so the page reflects the new state instead of
      // offering the same action again.
      try {
        const refreshed = await searchReceptionMember({ memberId });
        setMember(refreshed);
      } catch {
        // Non-fatal: the receipt is what matters most.
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PENDING_MEMBERSHIP_ORDER_EXISTS') {
        getReceptionPendingOrder(memberId)
          .then((order) => setPendingOrder(order ?? null))
          .catch(() => {});
      }
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const conflictCode = error?.response?.data?.code;
  const conflictMessage = CONFLICT_MESSAGES[conflictCode];

  async function handleCancelOrder() {
    const order = pendingOrder;
    if (!order) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError(new Error('Vui lòng nhập lý do huỷ đơn.'));
      return;
    }

    setSubmittingCancel(true);
    setCancelError(null);
    try {
      await cancelMembershipOrder(order.orderId, { reason });
      // The order is EXPIRED now, so the member no longer blocks new ones and
      // the cash form becomes usable. Re-read rather than assume, in case the
      // backend reported a race.
      setPendingOrder(null);
      setCancelling(false);
      setCancelReason('');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'CONFLICT' || err?.response?.status === 409) {
        // Someone else paid or cancelled it while the modal was open — the
        // pending banner is stale, so refresh instead of retrying.
        getReceptionPendingOrder(memberId)
          .then((fresh) => {
            setPendingOrder(fresh ?? null);
            if (!fresh) setCancelling(false);
          })
          .catch(() => {});
      }
      setCancelError(err);
    } finally {
      setSubmittingCancel(false);
    }
  }

  // ---------- STEP 1: pick the member (no deep link yet) ----------
  if (!memberId) {
    return (
      <div>
        <header className="mb-3">
          <h1 className="h3 fw-bold mb-1">Thu tiền mặt</h1>
          <p className="text-muted mb-0">
            Tìm hội viên, chọn gói tập và xác nhận đã nhận tiền mặt.
          </p>
        </header>

        <Card className="border-0 shadow-sm">
          <Card.Body>
            <h2 className="h6 fw-bold mb-3">Bước 1 — Tìm hội viên</h2>
            <Form onSubmit={handleLookupSubmit}>
              <Row className="g-3 align-items-end">
                <Col md={3}>
                  <Form.Label className="small text-muted mb-1">Tra cứu theo</Form.Label>
                  <div className="btn-group w-100" role="group" aria-label="Tiêu chí tra cứu">
                    <Button
                      variant={criterion === 'memberId' ? 'danger' : 'outline-danger'}
                      onClick={() => setCriterion('memberId')}
                      type="button"
                    >
                      Mã hội viên
                    </Button>
                    <Button
                      variant={criterion === 'phone' ? 'danger' : 'outline-danger'}
                      onClick={() => setCriterion('phone')}
                      type="button"
                    >
                      Số điện thoại
                    </Button>
                  </div>
                </Col>

                <Col md={5}>
                  <Form.Label className="small text-muted mb-1">
                    {criterion === 'memberId' ? 'Mã hội viên' : 'Số điện thoại'}
                  </Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      value={criterion === 'memberId' ? memberIdInput : phoneInput}
                      onChange={(e) =>
                        criterion === 'memberId'
                          ? setMemberIdInput(e.target.value)
                          : setPhoneInput(e.target.value)
                      }
                      placeholder={criterion === 'memberId' ? 'MB-123' : '0901234567'}
                      inputMode={criterion === 'phone' ? 'numeric' : 'text'}
                      maxLength={criterion === 'phone' ? 15 : 20}
                      aria-label={criterion === 'memberId' ? 'Mã hội viên' : 'Số điện thoại'}
                    />
                  </InputGroup>
                </Col>

                <Col md={4} className="d-flex gap-2">
                  <Button type="submit" variant="danger" disabled={searching}>
                    {searching ? <Spinner animation="border" size="sm" /> : 'Tìm'}
                  </Button>
                  {memberIdInput || phoneInput ? (
                    <Button
                      type="button"
                      variant="outline-secondary"
                      onClick={handleClearMember}
                    >
                      Xoá
                    </Button>
                  ) : null}
                </Col>
              </Row>
            </Form>

            {searchError ? (
              <ErrorAlert
                error={searchError}
                title="Không tra cứu được hội viên"
                onClose={() => setSearchError(null)}
              />
            ) : null}

            <p className="text-muted small mb-0 mt-3">
              Tra cứu là chính xác — không tìm theo tên hay email. Nhập mã hội viên
              hoặc số điện thoại để sang bước chọn gói tập. Nếu hội viên chưa có
              tài khoản,{' '}
              <Link to="/reception/members/new">đăng ký hội viên mới</Link> trước.
            </p>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // ---------- STEP 2: loading the member ----------
  if (loading) {
    return (
      <div>
        <header className="mb-3">
          <h1 className="h3 fw-bold mb-1">Thu tiền mặt</h1>
        </header>
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      </div>
    );
  }

  // ---------- Member could not be loaded ----------
  if (error && !member) {
    return (
      <div>
        <header className="mb-3">
          <h1 className="h3 fw-bold mb-1">Thu tiền mặt</h1>
        </header>
        <ErrorAlert error={error} title="Không tải được thông tin hội viên" />
        <div className="d-flex gap-2">
          <Button variant="outline-danger" onClick={handleClearMember}>
            ← Tìm hội viên khác
          </Button>
          <Button as={Link} to="/reception/members" variant="outline-secondary">
            Mở trang tra cứu
          </Button>
        </div>
      </div>
    );
  }

  // ---------- STEP 3: choose the offer and confirm ----------
  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Thu tiền mặt</h1>
        <p className="text-muted mb-0">
          Bước 2 — Chọn gói và xác nhận đã nhận tiền mặt.
        </p>
      </header>

      {receipt ? (
        <Alert variant="success">
          <Alert.Heading className="h6 mb-2">
            Đã thu tiền và kích hoạt gói tập
          </Alert.Heading>
          <p className="small mb-3">
            Giao dịch hoàn tất tức thì. Bàn giao hội viên kèm biên lai bên dưới.
          </p>
          {/* The receipt preview is rendered inline instead of dumping raw
              UUIDs at the receptionist: this is the document the customer
              receives, and it has to be readable — and printable — from the
              screen they are already on. */}
          <div className="receipt-preview bg-white rounded border p-3 mb-3">
            <div className="text-center mb-2">
              <div className="fw-bold">BIÊN LAI THU TIỀN</div>
              <div className="text-muted small">SWP GYM — Trung tâm quản lý hội viên</div>
            </div>
            <Table borderless size="sm" className="small mb-0">
              <tbody>
                <tr>
                  <td className="text-muted fw-normal" style={{ width: 150 }}>
                    Hội viên
                  </td>
                  <td>
                    <strong>{member?.fullName || '—'}</strong>
                    {memberId ? <span className="text-muted"> ({memberId})</span> : null}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted fw-normal">Gói tập</td>
                  <td>
                    <strong>{purchased?.name || '—'}</strong>
                    {purchased ? ` — ${purchased.durationDays} ngày` : ''}
                  </td>
                </tr>
                <tr>
                  <td className="text-muted fw-normal">Phương thức</td>
                  <td>Tiền mặt</td>
                </tr>
                <tr className="border-top">
                  <td className="text-muted fw-normal">Số tiền</td>
                  <td>
                    <strong className="text-danger fs-6">
                      {purchased
                        ? formatPrice(purchased.priceAmount, purchased.currencyCode)
                        : '—'}
                    </strong>
                  </td>
                </tr>
              </tbody>
            </Table>
            <div className="text-center text-muted small mt-2 pt-2 border-top">
              Cảm ơn quý khách. Vui lòng giữ lại biên lai này.
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => window.print()}>
              In biên lai
            </Button>
            {receipt.receiptId ? (
              <Button
                // The member name, code and plan now come from the receipt
                // API itself, so only the plan duration is handed over —
                // ReceiptResponse does not carry it yet.
                as={Link}
                to={`/receipts/${receipt.receiptId}`}
                state={{ durationDays: purchased?.durationDays ?? null }}
                variant="outline-danger"
                size="sm"
              >
                Xem đầy đủ &amp; tải PDF
              </Button>
            ) : null}
            <Button
              as={Link}
              to={`/reception/members/${memberId}`}
              variant="outline-secondary"
              size="sm"
            >
              Về hồ sơ hội viên
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleClearMember}
            >
              Thu tiền cho hội viên khác
            </Button>
          </div>
        </Alert>
      ) : null}

      {isSuspended ? (
        <Alert variant="danger">
          Tài khoản đang ở trạng thái{' '}
          <strong>{MEMBER_STATUS_LABELS[memberStatus] || memberStatus}</strong> nên
          không thể thu tiền. Hãy kích hoạt lại tài khoản trước.
        </Alert>
      ) : null}

      {blockedByPendingOrder ? (
        <Alert variant="warning">
          <Alert.Heading className="h6 mb-1">Đơn đang chờ thanh toán</Alert.Heading>
          <div className="small mb-2">
            Hội viên đang có đơn chưa thanh toán (
            <strong>{pendingOrder.orderNumber}</strong> — {pendingOrder.offerName},{' '}
            {formatPrice(pendingOrder.priceAmount, pendingOrder.currencyCode)}) nên
            không thể tạo giao dịch tiền mặt mới.
          </div>
          {pendingOrder.paymentMethod === 'CASH' ? (
            <div className="small text-muted mb-0">
              Đơn này được ghi nhận bằng <strong>tiền mặt</strong> nhưng vẫn ở
              trạng thái chờ — đây là dữ liệu không nhất quán, hãy báo quản trị viên
              kiểm tra lại trước khi thu tiền.
            </div>
          ) : (
            <div className="small text-muted mb-0">
              Đơn này là <strong>chuyển khoản ngân hàng</strong>, chưa có tiền thật.
              Thu tiền mặt không áp dụng được cho đơn đó — màn hình này tạo giao dịch
              mới, không chuyển đổi đơn cũ. Nếu đơn bị tạo nhầm, hãy huỷ nó rồi
              thu tiền mặt ngay tại đây. Nếu khách đã chuyển khoản thật, đừng huỷ —
              dùng màn hình <strong>Đối soát</strong> để ghi nhận.
            </div>
          )}
          <div className="d-flex flex-wrap gap-2 mt-3">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setCancelling(true)}
            >
              Huỷ đơn treo &amp; thu tiền mặt
            </Button>
            <Button
              as={Link}
              to="/reception/payments/reconcile"
              variant="outline-secondary"
              size="sm"
            >
              Mở màn hình Đối soát
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* Cancelling is a real, auditable staff action (the backend writes a
          MEMBERSHIP_ORDER_CANCELLED audit event), so it needs a stated
          reason rather than a bare confirm. */}
      <Modal
        show={cancelling}
        onHide={() => setCancelling(false)}
        centered
        backdrop={submittingCancel ? 'static' : true}
      >
        <Modal.Header closeButton>
          <Modal.Title className="h6">Huỷ đơn {pendingOrder?.orderNumber}</Modal.Title>
        </Modal.Header>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleCancelOrder();
          }}
        >
          <Modal.Body>
            <p className="small mb-3">
              Đơn này đang ở trạng thái chờ thanh toán chuyển khoản. Huỷ đơn sẽ chuyển
              nó sang <strong>EXPIRED</strong> và vô hiệu hoá các khoản thanh toán
              đang chờ, sau đó bạn có thể thu tiền mặt tại đây. Thao tác được ghi
              vào nhật ký hệ thống và không thể hoàn tác.
            </p>
            <Form.Group>
              <Form.Label className="small text-muted mb-1">
                Lý do huỷ <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Khách đưa tiền mặt, không chuyển khoản. Đơn tạo nhầm."
                maxLength={200}
                required
                autoFocus
              />
              <Form.Text className="text-muted">
                Bắt buộc — backend từ chối lý do rỗng.
              </Form.Text>
            </Form.Group>
            <ErrorAlert
              error={cancelError}
              title="Không huỷ được đơn"
              onClose={() => setCancelError(null)}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => setCancelling(false)}
              disabled={submittingCancel}
            >
              Quay lại
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!cancelReason.trim() || submittingCancel}
            >
              {submittingCancel ? (
                <Spinner animation="border" size="sm" />
              ) : (
                'Huỷ đơn'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {conflictMessage ? (
        <Alert variant="warning">{conflictMessage}</Alert>
      ) : null}

      {error && !conflictMessage ? (
        <ErrorAlert error={error} title="Không thu được tiền" onClose={() => setError(null)} />
      ) : null}

      <Row className="g-3">
        <Col lg={7}>
          <Form onSubmit={handleSubmit}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 className="h6 fw-bold mb-0">Bước 2 — Chọn gói tập</h2>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 text-decoration-none"
                    onClick={handleClearMember}
                  >
                    Đổi hội viên
                  </Button>
                </div>

                {offers.length === 0 ? (
                  <p className="text-muted mb-0">Hiện không có gói tập nào đang bán.</p>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Gói tập</Form.Label>
                      <Form.Select
                        value={offerId}
                        onChange={(e) => setOfferId(e.target.value)}
                        required
                      >
                        <option value="">-- Chọn gói tập --</option>
                        {offers.map((offer) => (
                          <option key={offer.offerId} value={offer.offerId}>
                            {offer.name} —{' '}
                            {formatPrice(offer.priceAmount, offer.currencyCode)} /{' '}
                            {offer.durationDays} ngày
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    {selectedOffer ? (
                      <div className="border rounded p-3 bg-body-tertiary">
                        <div className="fw-semibold mb-1">{selectedOffer.name}</div>
                        {selectedOffer.description ? (
                          <p
                            className="text-muted small mb-2"
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {selectedOffer.description}
                          </p>
                        ) : null}
                        <div className="small text-muted">
                          Thời hạn: {selectedOffer.durationDays} ngày · Giá:{' '}
                          <strong className="text-danger">
                            {formatPrice(
                              selectedOffer.priceAmount,
                              selectedOffer.currencyCode,
                            )}
                          </strong>
                        </div>
                      </div>
                    ) : null}

                    <Alert variant="light" className="border small text-muted mt-3 mb-3">
                      Xác nhận này ghi nhận đã nhận đủ tiền mặt tại quầy, tạo gói tập
                      và xuất biên lai ngay lập tức. Thao tác không thể hoàn tác và
                      không có thời hạn chờ — nếu tiền chưa thực tế nhận, đừng xác nhận.
                      Giao dịch này độc lập với đơn chuyển khoản: nó tự tạo đơn riêng
                      với phương thức <strong>CASH</strong>.
                    </Alert>

                    {/* The button is disabled for blocked states, so say why
                        right here instead of leaving the user to guess. */}
                    {isSuspended || blockedByPendingOrder ? (
                      <p className="text-danger small mb-2">
                        {isSuspended
                          ? 'Tài khoản không ACTIVE nên không thể thu tiền.'
                          : 'Không thể thu tiền mặt khi hội viên còn đơn chờ thanh toán.'}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      variant="danger"
                      disabled={!offerId || isSuspended || submitting || blockedByPendingOrder}
                    >
                      {submitting ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        'Xác nhận đã nhận tiền mặt'
                      )}
                    </Button>
                  </>
                )}
              </Card.Body>
            </Card>
          </Form>
        </Col>

        <Col lg={5}>
          <Card className="border-0 shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 fw-bold mb-3">Thông tin hội viên</h2>
              <dl className="row mb-0 small">
                <dt className="col-5 text-muted fw-normal">Mã hội viên</dt>
                <dd className="col-7">{memberId}</dd>
                <dt className="col-5 text-muted fw-normal">Họ tên</dt>
                <dd className="col-7">{member?.fullName || '—'}</dd>
                <dt className="col-5 text-muted fw-normal">Trạng thái</dt>
                <dd className="col-7">
                  {MEMBER_STATUS_LABELS[memberStatus] || memberStatus || '—'}
                </dd>
                <dt className="col-5 text-muted fw-normal">Điện thoại</dt>
                <dd className="col-7">{member?.phone || '—'}</dd>
                <dt className="col-5 text-muted fw-normal">Email</dt>
                <dd className="col-7 text-break">{member?.email || '—'}</dd>
              </dl>
            </Card.Body>
          </Card>

          <Alert variant="light" className="border small text-muted mb-0">
            Thanh toán tiền mặt là giao dịch tức thì: gói tập được kích hoạt và
            biên lai được xuất ngay. Nếu khách chuyển khoản ngân hàng, dùng màn
            hình <strong>Tạo đơn gói tập</strong> thay vì màn hình này.
          </Alert>
        </Col>
      </Row>
    </div>
  );
}