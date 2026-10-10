// Member – Thanh toán gói tập (/member/checkout/:offerId).
//
// Luồng:
//   1. Tải gói tập (GET /membership-offers/{offerId}, công khai), gói đang có
//      của Member và đơn đang chờ thanh toán (nếu có).
//   2. Hội viên bấm "Xác nhận & thanh toán":
//        a. chưa có đơn chờ -> tạo Order   POST /members/me/membership-orders
//        b. tạo / lấy lại yêu cầu thanh toán
//           POST /members/me/membership-orders/{orderId}/payments/sepay
//   3. Hiện mã QR + thông tin chuyển khoản; cứ 5 giây hỏi kết quả
//        GET /payments/{paymentId}/result  cho đến khi PAID.
//
// Quy tắc nghiệp vụ (BE kiểm tra lại, FE chỉ chặn sớm để người dùng dễ hiểu):
//   BR-MEM-08  : đang có Membership ACTIVE thì không mua gói mới.
//   BR-ORD-07  : tối đa 1 đơn PENDING_PAYMENT. Hội viên không tự hủy đơn được
//                (chỉ Lễ tân / Quản lý), nên phải hoàn tất đơn đó hoặc nhờ lễ tân.
//   BR-PAY-03  : QR đúng số tiền + nội dung chuyển khoản của Order.
//   BR-PAY-04  : quét / hiển thị QR không phải xác nhận thanh toán.
//   BR-PAY-10  : hạn thanh toán 24 giờ, quá hạn vẫn giữ PENDING để đối soát tay.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { getOfferById } from '../../../services/membershipService';
import {
  createMyMembershipOrder,
  getMyPendingMembershipOrder,
} from '../../../services/memberService';
import {
  createSepayPayment,
  getPaymentResult,
} from '../../../services/paymentService';
import { formatDateTime, formatPrice } from '../../../utils';
import { buildFeatures, formatDuration } from '../../public/offers/offerUtils';
import './MemberCheckoutPage.css';

const POLL_INTERVAL_MS = 5000;

// Thông báo theo mã lỗi / trạng thái của BE (xử lý theo status và code).
const ERROR_MESSAGES = {
  ACTIVE_MEMBERSHIP_EXISTS:
    'Bạn đang có gói tập còn hiệu lực nên chưa thể mua gói mới.',
  PENDING_MEMBERSHIP_ORDER_EXISTS:
    'Bạn đang có một đơn chờ thanh toán. Hãy hoàn tất đơn đó trước.',
  MEMBERSHIP_OFFER_NOT_FOUND: 'Gói tập này không còn được bán.',
  MEMBER_NOT_ACTIVE:
    'Tài khoản của bạn không ở trạng thái cho phép mua gói tập.',
  PAYMENT_CONFLICT:
    'Đơn này hiện không thể thanh toán (có thể đã được xử lý). Vui lòng tải lại trang.',
  PAYMENT_NOT_FOUND: 'Không tìm thấy đơn hàng.',
};

function errorMessage(err, fallback) {
  const code = err?.response?.data?.code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (!err?.response) return 'Không kết nối được máy chủ. Vui lòng thử lại.';
  if (err.response.status >= 500) {
    return 'Hệ thống thanh toán tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ lễ tân.';
  }
  return fallback;
}

// "23 giờ 12 phút" từ số mili-giây còn lại.
function formatRemaining(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export default function MemberCheckoutPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const {
    activeMembership,
    hasActiveMembership,
    loading: membershipLoading,
    reload: reloadMemberships,
  } = useMemberArea();

  const [offer, setOffer] = useState(null);
  const [offerError, setOfferError] = useState(null);
  const [offerLoading, setOfferLoading] = useState(true);

  const [pending, setPending] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [payment, setPayment] = useState(null); // yêu cầu thanh toán SePay
  const [result, setResult] = useState(null); // kết quả thanh toán (PENDING/PAID/FAILED)
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [qrBroken, setQrBroken] = useState(false);
  const [copied, setCopied] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ----- Tải gói tập -----
  useEffect(() => {
    let cancelled = false;
    setOfferLoading(true);
    setOfferError(null);
    getOfferById(offerId)
      .then((data) => {
        if (!cancelled) setOffer(data);
      })
      .catch((err) => {
        if (!cancelled) setOfferError(err);
      })
      .finally(() => {
        if (!cancelled) setOfferLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  // ----- Tải đơn đang chờ thanh toán -----
  useEffect(() => {
    let cancelled = false;
    getMyPendingMembershipOrder()
      .then((order) => {
        if (!cancelled) setPending(order);
      })
      .catch(() => {
        // Không đọc được đơn chờ: BE vẫn kiểm tra lại khi tạo đơn.
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Đồng hồ cập nhật mỗi 30 giây (đếm ngược hạn thanh toán).
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  // ----- Hỏi kết quả thanh toán -----
  const checkResult = useCallback(async () => {
    if (!payment?.paymentId) return;
    try {
      const r = await getPaymentResult(payment.paymentId);
      setResult(r);
      if (r?.status === 'PAID') reloadMemberships();
    } catch {
      // Lỗi tạm thời: bỏ qua, lần hỏi sau sẽ thử lại.
    }
  }, [payment, reloadMemberships]);

  const settled = result?.status === 'PAID' || result?.status === 'FAILED';
  useEffect(() => {
    if (!payment || settled) return undefined;
    const timer = setInterval(checkResult, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [payment, settled, checkResult]);

  // ----- Bấm "Xác nhận & thanh toán" -----
  async function handlePay() {
    setActionError(null);
    setBusy(true);
    try {
      // BR-ORD-01: mua gói bắt đầu bằng một Order. Đã có đơn chờ cùng gói thì
      // dùng lại; BE tự trả lại Payment PENDING đang có (không tạo trùng).
      const order =
        pending && pending.offerId === offer.offerId
          ? pending
          : await createMyMembershipOrder({ offerId: offer.offerId });
      setPending(order);
      setPayment(await createSepayPayment(order.orderId));
      setResult(null);
      setQrBroken(false);
    } catch (err) {
      setActionError(errorMessage(err, 'Không tạo được yêu cầu thanh toán.'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(key, text) {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500);
    } catch {
      // Trình duyệt chặn sao chép: người dùng tự chép từ ô thông tin.
    }
  }

  // ----- Hiển thị -----
  const loading = offerLoading || pendingLoading || membershipLoading;

  if (loading) {
    return (
      <div className="mco-center">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (offerError || !offer) {
    return (
      <div className="mco">
        <div className="mco-card mco-state">
          <h1 className="mco-title">Không tìm thấy gói tập</h1>
          <p className="mco-muted">
            {offerError?.response?.status === 404
              ? 'Gói tập này không tồn tại hoặc không còn được bán.'
              : 'Không tải được thông tin gói tập. Vui lòng thử lại.'}
          </p>
          <Link to="/offers" className="mco-btn primary">
            Xem bảng gói tập
          </Link>
        </div>
      </div>
    );
  }

  const planCode =
    activeMembership?.planCode ?? activeMembership?.plan_code_snapshot ?? '';
  const pendingOther = pending && pending.offerId !== offer.offerId;
  const paid = result?.status === 'PAID';
  const failed = result?.status === 'FAILED';
  const expiresMs = payment ? new Date(payment.expiresAt).getTime() : 0;
  const expired = payment && expiresMs > 0 && expiresMs <= nowMs;

  return (
    <div className="mco">
      <Link to="/offers" className="mco-back">
        ← Quay lại bảng gói tập
      </Link>
      <h1 className="mco-title">Thanh toán gói tập</h1>

      <div className="mco-grid">
        {/* ===== Tóm tắt đơn hàng ===== */}
        <section className="mco-card">
          <h2 className="mco-h2">Đơn hàng của bạn</h2>
          <div className="mco-plan">
            <span className={`mco-plan-tag${offer.planCode === 'PLUS' ? ' plus' : ''}`}>
              {offer.planDisplayName || offer.planCode}
            </span>
            <span className="mco-muted">{formatDuration(offer.durationDays)}</span>
          </div>
          <div className="mco-offer-name">{offer.name}</div>
          {offer.description ? (
            <p className="mco-muted mco-offer-desc">{offer.description}</p>
          ) : null}

          <ul className="mco-feat">
            {buildFeatures(offer).map((f) => (
              <li key={f.text} className={f.ok ? '' : 'off'}>
                <span aria-hidden="true">{f.ok ? '✓' : '✕'}</span> {f.text}
              </li>
            ))}
          </ul>

          <div className="mco-total">
            <span>Tổng thanh toán</span>
            <strong>{formatPrice(offer.priceAmount, offer.currencyCode)}</strong>
          </div>
          <div className="mco-note">
            Phương thức: <strong>Chuyển khoản ngân hàng</strong>. Gói tập có hiệu
            lực sau khi thanh toán được xác nhận.
          </div>
        </section>

        {/* ===== Khung thanh toán ===== */}
        <section className="mco-card">
          {paid ? (
            <div className="mco-state">
              <div className="mco-icon ok" aria-hidden="true">✓</div>
              <h2 className="mco-h2">Thanh toán thành công</h2>
              <p className="mco-muted">
                Cảm ơn bạn! Gói <strong>{offer.name}</strong> đã được kích hoạt
                {result?.paidAt ? ` lúc ${formatDateTime(result.paidAt)}` : ''}.
              </p>
              <div className="mco-actions">
                <Link to="/member/plan" className="mco-btn primary">
                  Xem gói tập của tôi
                </Link>
                <Link to="/member/memberships" className="mco-btn ghost">
                  Lịch sử thanh toán
                </Link>
              </div>
            </div>
          ) : hasActiveMembership ? (
            <div className="mco-state">
              <h2 className="mco-h2">Bạn đang có gói tập còn hiệu lực</h2>
              <p className="mco-muted">
                Gói {planCode || 'hiện tại'} của bạn vẫn đang hoạt động. Bạn chỉ
                mua gói mới sau khi gói hiện tại hết hạn.
              </p>
              <div className="mco-actions">
                <Link to="/member/plan" className="mco-btn primary">
                  Xem gói tập của tôi
                </Link>
              </div>
            </div>
          ) : pendingOther ? (
            <div className="mco-state">
              <h2 className="mco-h2">Bạn đang có đơn chờ thanh toán</h2>
              <p className="mco-muted">
                Đơn <strong>{pending.orderNumber}</strong> (gói{' '}
                <strong>{pending.offerName}</strong>,{' '}
                {formatPrice(pending.priceAmount, pending.currencyCode)}) chưa
                được thanh toán. Mỗi lần chỉ được một đơn chờ: hãy hoàn tất đơn
                này, hoặc liên hệ lễ tân để hủy nếu muốn đổi gói.
              </p>
              <div className="mco-actions">
                <button
                  type="button"
                  className="mco-btn primary"
                  onClick={() => navigate(`/member/checkout/${pending.offerId}`)}
                >
                  Tiếp tục thanh toán đơn này
                </button>
              </div>
            </div>
          ) : payment ? (
            <PaymentPanel
              payment={payment}
              failed={failed}
              expired={expired}
              remainingMs={expiresMs - nowMs}
              qrBroken={qrBroken}
              onQrError={() => setQrBroken(true)}
              copied={copied}
              onCopy={copy}
              onCheck={checkResult}
            />
          ) : (
            <div className="mco-state">
              <h2 className="mco-h2">Xác nhận thanh toán</h2>
              <p className="mco-muted">
                Sau khi xác nhận, hệ thống tạo mã QR và thông tin chuyển khoản
                cho đơn này. Bạn có <strong>24 giờ</strong> để hoàn tất.
              </p>
              {actionError ? (
                <div className="mco-error" role="alert">{actionError}</div>
              ) : null}
              <button
                type="button"
                className="mco-btn primary block"
                onClick={handlePay}
                disabled={busy}
              >
                {busy
                  ? 'Đang tạo yêu cầu thanh toán...'
                  : pending
                    ? 'Tiếp tục thanh toán'
                    : 'Xác nhận & thanh toán'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ----- Mã QR và thông tin chuyển khoản -----
function PaymentPanel({
  payment,
  failed,
  expired,
  remainingMs,
  qrBroken,
  onQrError,
  copied,
  onCopy,
  onCheck,
}) {
  const rows = [
    { key: 'amount', label: 'Số tiền', value: payment.amount, display: formatPrice(payment.amount, payment.currency) },
    { key: 'content', label: 'Nội dung chuyển khoản', value: payment.transferContent },
    { key: 'bank', label: 'Ngân hàng', value: payment.bankCode },
    { key: 'account', label: 'Số tài khoản', value: payment.bankAccountNumber },
    { key: 'name', label: 'Chủ tài khoản', value: payment.bankAccountName },
  ];

  return (
    <div>
      <h2 className="mco-h2">Chuyển khoản để hoàn tất</h2>

      {failed ? (
        <div className="mco-error" role="alert">
          Thanh toán không thành công. Vui lòng liên hệ lễ tân để được hỗ trợ.
        </div>
      ) : (
        <div className={`mco-status${expired ? ' warn' : ''}`}>
          <span className="mco-dot" aria-hidden="true" />
          {expired
            ? 'Đã quá hạn 24 giờ. Nếu bạn đã chuyển khoản, lễ tân sẽ đối soát giúp bạn.'
            : `Đang chờ thanh toán · còn ${formatRemaining(remainingMs)}`}
        </div>
      )}

      <div className="mco-pay">
        <div className="mco-qr">
          {payment.qrUrl && !qrBroken ? (
            <img
              src={payment.qrUrl}
              alt="Mã QR chuyển khoản"
              onError={onQrError}
            />
          ) : (
            <div className="mco-qr-fallback">
              Không tải được mã QR. Hãy chuyển khoản thủ công theo thông tin bên
              cạnh.
            </div>
          )}
        </div>

        <dl className="mco-info">
          {rows.map((r) => (
            <div className="mco-info-row" key={r.key}>
              <dt>{r.label}</dt>
              <dd>
                <span>{r.display ?? r.value ?? '—'}</span>
                {r.value ? (
                  <button
                    type="button"
                    className="mco-copy"
                    onClick={() => onCopy(r.key, r.value)}
                  >
                    {copied === r.key ? 'Đã chép' : 'Sao chép'}
                  </button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mco-note">
        Hãy nhập <strong>đúng nội dung chuyển khoản</strong> để hệ thống tự xác
        nhận. Quét hoặc hiển thị mã QR chưa phải là đã thanh toán; trang tự cập
        nhật khi ngân hàng báo đã nhận tiền.
      </div>

      <button type="button" className="mco-btn ghost block" onClick={onCheck}>
        Tôi đã chuyển khoản, kiểm tra ngay
      </button>
    </div>
  );
}
