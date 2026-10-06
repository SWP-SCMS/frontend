// Receptionist – Create a bank-transfer Membership Order for a Member (US16).
//
// BE: POST /api/v1/reception/members/{memberId}/membership-orders
//       body: { offerId }   (additionalProperties: false — nothing else)
//     GET  /api/v1/reception/members/{memberId}/membership-orders/pending
//       200 -> existing PENDING_PAYMENT order, 204 -> none
//
// Contract details that shape this UI:
//   - This is BANK TRANSFER only. The us16 spec states "Cash is outside US16
//     and must not call this operation", and that still holds: the
//     MembershipOrderCreateRequest body is exactly { offerId } and the
//     backend rejects any extra field. Cash lives on its own endpoint,
//     POST /reception/members/{memberId}/cash-payments, which this page
//     links to rather than duplicating.
//   - The order stores an Offer SNAPSHOT (offerName, priceAmount,
//     durationDays). We display the returned snapshot, never re-read the
//     live Offer, so the summary can't drift from what was ordered.
//   - 409 PENDING_MEMBERSHIP_ORDER_EXISTS means the member already has an
//     unpaid order; we surface the resume view instead of a raw error.
//   - 409 ACTIVE_MEMBERSHIP_EXISTS means they already have a live membership.
//   - 404/409 also cover MEMBER_NOT_FOUND and MEMBER_NOT_ACTIVE (suspended or
//     inactive members cannot order).

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import {
  createReceptionMembershipOrder,
  getReceptionPendingOrder,
  searchReceptionMember,
} from '../../../services/receptionistService';
import { listActiveOffers } from '../../../services/membershipService';
import { formatDateTime, formatPrice } from '../../../utils';

export default function MembershipOrderCreatePage() {
  const [params] = useSearchParams();
  const memberId = params.get('memberId') || '';

  const [member, setMember] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offerId, setOfferId] = useState('');
  const [pending, setPending] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMember(null);
    setPending(null);
    setCreated(null);
    setOfferId('');

    if (!memberId) {
      setLoading(false);
      return undefined;
    }

    Promise.all([
      searchReceptionMember({ memberId }),
      listActiveOffers(),
      getReceptionPendingOrder(memberId).catch(() => null),
    ])
      .then(([found, offerList, pendingOrder]) => {
        if (cancelled) return;
        setMember(found);
        setOffers(offerList);
        setPending(pendingOrder);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!offerId) {
      setError(new Error('Vui lòng chọn một gói tập.'));
      return;
    }

    setSubmitting(true);
    try {
      const order = await createReceptionMembershipOrder(memberId, { offerId });
      setCreated(order);
      setPending(order);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PENDING_MEMBERSHIP_ORDER_EXISTS') {
        // Surface the existing order instead of a raw 409.
        getReceptionPendingOrder(memberId)
          .then((order) => setPending(order ?? null))
          .catch(() => {});
      }
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!memberId) {
    return (
      <div>
        <header className="mb-3">
          <h1 className="h3 fw-bold mb-1">Tạo đơn gói tập</h1>
        </header>
        <div className="card border-0 shadow-sm">
          <EmptyState
            title="Chưa chọn hội viên"
            message="Tra cứu một hội viên trước, rồi mở trang này từ hồ sơ của hội viên đó."
            action={
              <Button as={Link} to="/reception/members" variant="outline-danger">
                Đi tới tra cứu hội viên
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error && !member) {
    return (
      <div>
        <ErrorAlert error={error} title="Không tải được thông tin hội viên" />
        <Button as={Link} to="/reception/members" variant="outline-secondary">
          ← Quay lại tra cứu
        </Button>
      </div>
    );
  }

  const selectedOffer = offers.find((o) => o.offerId === offerId) || null;
  const isSuspended = member && member.status !== 'ACTIVE';

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Tạo đơn gói tập</h1>
        <p className="text-muted mb-0">
          Hội viên <span className="fw-semibold">{member?.fullName}</span> ({memberId})
        </p>
      </header>

      {created ? (
        <Alert variant="success">
          <Alert.Heading className="h6 mb-1">Đã tạo đơn thành công</Alert.Heading>
          <div className="small">
            Mã đơn <strong>{created.orderNumber}</strong> — chuyển khoản ngân hàng.
            Hạn thanh toán được tính khi hệ thống tạo mã QR thanh toán.
          </div>
          {/* The order-create contract is bank transfer only: the body is
              exactly { offerId } and the backend rejects extra fields, so
              there is no "already received the money" step on this order.
              A cash sale is a separate flow. Say so here, because after
              creating an order the user has no other way to discover that. */}
          <Alert variant="light" className="border small mt-3 mb-0">
            <div className="fw-semibold mb-1">Khách đưa tiền mặt tại quầy?</div>
            <div className="text-muted mb-2">
              Đơn này không có bước xác nhận thu tiền mặt và sẽ treo ở trạng thái
              chờ thanh toán. Nếu đơn bị tạo nhầm, hãy huỷ nó ở màn hình Thu tiền
              mặt rồi thu tiền ngay tại đó — gói tập và biên lai được tạo ngay lập
              tức. Nếu khách đã chuyển khoản thật, dùng màn hình Đối soát.
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button
                as={Link}
                to={`/reception/payments/cash?memberId=${memberId}`}
                variant="danger"
                size="sm"
              >
                Thu tiền mặt cho hội viên này
              </Button>
              <Button
                as={Link}
                to="/reception/payments/reconcile"
                variant="outline-secondary"
                size="sm"
              >
                Đối soát đơn chuyển khoản
              </Button>
            </div>
          </Alert>
        </Alert>
      ) : null}

      {pending && !created ? (
        <Alert variant="warning">
          <Alert.Heading className="h6 mb-1">Đơn đang chờ thanh toán</Alert.Heading>
          <div className="small">
            Hội viên đang có đơn chưa thanh toán (
            <strong>{pending.orderNumber}</strong> — {pending.offerName},{' '}
            {formatPrice(pending.priceAmount, pending.currencyCode)}). Không thể tạo
            đơn mới cho tới khi đơn này được xử lý.
          </div>
          {pending.paymentMethod === 'CASH' ? null : (
            <div className="small text-muted mt-2 mb-0">
              Đơn này là <strong>chuyển khoản</strong>, nên nó chỉ được chuyển sang
              đã thanh toán khi khách chuyển khoản thật hoặc quầy đối soát tại màn
              hình <strong>Đối soát</strong>. Không có nút xác nhận thu tiền mặt ở
              đây — nếu khách đưa tiền mặt, hãy huỷ đơn treo rồi dùng màn hình{' '}
              <Link to={`/reception/payments/cash?memberId=${memberId}`}>
                Thu tiền mặt
              </Link>
              .
            </div>
          )}
        </Alert>
      ) : null}

      {isSuspended ? (
        <Alert variant="danger">
          Tài khoản đang ở trạng thái <strong>{member.status}</strong> nên không thể
          tạo đơn gói tập mới.
        </Alert>
      ) : null}

      <ErrorAlert
        error={error}
        title="Không tạo được đơn gói tập"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <Row className="g-3">
        <Col lg={7}>
          <Form onSubmit={handleSubmit}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <h2 className="h6 fw-bold mb-3">Chọn gói tập</h2>

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
                            {offer.name} — {formatPrice(offer.priceAmount, offer.currencyCode)}{' '}
                            / {offer.durationDays} ngày
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    {selectedOffer ? (
                      <div className="border rounded p-3 bg-body-tertiary">
                        <div className="fw-semibold mb-1">{selectedOffer.name}</div>
                        {selectedOffer.description ? (
                          <p className="text-muted small mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                            {selectedOffer.description}
                          </p>
                        ) : null}
                        <div className="small text-muted">
                          Thời hạn: {selectedOffer.durationDays} ngày · Giá:{' '}
                          <strong className="text-danger">
                            {formatPrice(selectedOffer.priceAmount, selectedOffer.currencyCode)}
                          </strong>
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      variant="danger"
                      className="mt-3"
                      disabled={submitting || !offerId || isSuspended || Boolean(pending && !created)}
                    >
                      {submitting ? <Spinner animation="border" size="sm" /> : 'Tạo đơn'}
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
              <h2 className="h6 fw-bold mb-3">Hồ sơ đơn</h2>
              {created ? (
                <dl className="row mb-0 small">
                  <dt className="col-5 text-muted fw-normal">Mã đơn</dt>
                  <dd className="col-7">{created.orderNumber}</dd>
                  <dt className="col-5 text-muted fw-normal">Gói tập</dt>
                  <dd className="col-7">{created.offerName}</dd>
                  <dt className="col-5 text-muted fw-normal">Giá</dt>
                  <dd className="col-7">
                    {formatPrice(created.priceAmount, created.currencyCode)}
                  </dd>
                  <dt className="col-5 text-muted fw-normal">Thời hạn</dt>
                  <dd className="col-7">{created.durationDays} ngày</dd>
                  <dt className="col-5 text-muted fw-normal">Phương thức</dt>
                  <dd className="col-7">{created.paymentMethod}</dd>
                  <dt className="col-5 text-muted fw-normal">Trạng thái</dt>
                  <dd className="col-7">{created.status}</dd>
                  <dt className="col-5 text-muted fw-normal">Đã tạo lúc</dt>
                  <dd className="col-7">{formatDateTime(created.createdAt)}</dd>
                </dl>
              ) : (
                <p className="text-muted small mb-0">
                  Chọn một gói tập để xem thông tin đơn. Giá và thời hạn hiển thị
                  sau khi tạo là bản chụp tại thời điểm đặt đơn.
                </p>
              )}
            </Card.Body>
          </Card>

          <Alert variant="light" className="border small text-muted mb-0">
            Màn hình này tạo đơn <strong>chuyển khoản ngân hàng</strong>. Nếu khách
            đưa tiền mặt tại quầy, dùng màn hình <strong>Thu tiền mặt</strong> — gói
            tập được kích hoạt ngay. Thời hạn 24 giờ chỉ bắt đầu khi mã QR thanh
            toán được tạo.
          </Alert>
        </Col>
      </Row>
    </div>
  );
}
