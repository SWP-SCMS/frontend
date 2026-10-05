// Trang tổng quan Hội viên (nằm trong MemberLayout).
//
// Dữ liệu và API:
//   - Tên, mã hội viên, hồ sơ        : useAuth() (đã tải khi đăng nhập)
//   - Có gói tập đang hoạt động chưa : useMemberArea() <- GET /members/me/memberships
//   - Danh sách gói đang bán          : GET /membership-offers
//   - Đơn đang chờ thanh toán         : GET /members/me/membership-orders/pending
//   - Nút "Chọn gói"                  : POST /members/me/membership-orders
//
// Thanh toán chuyển khoản (US18) chưa làm ở FE: sau khi tạo đơn, trang chỉ
// hiển thị đơn đang chờ thanh toán.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../../context/useAuth';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listActiveOffers } from '../../../services/membershipService';
import {
  createMyMembershipOrder,
  getMyPendingMembershipOrder,
} from '../../../services/memberService';
import {
  extractErrorMessage,
  formatDate,
  formatDateTime,
  formatPrice,
} from '../../../utils';
import { MEMBERSHIP_PLAN } from '../../../constants';
import './MemberDashboardPage.css';

// ----- Icon SVG vẽ trực tiếp (không cài thư viện icon) -----

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ICONS = {
  alert: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M12 12v4M12 18h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    </>
  ),
  star: <path d="m12 2 3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z" />,
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
      {ICONS[name]}
    </svg>
  );
}

// ----- Dữ liệu cố định của màn hình -----

// Hai thẻ gói hiển thị (BR-SCP-04: MVP chỉ có BASIC và PLUS).
const PLAN_CARDS = [
  {
    planCode: MEMBERSHIP_PLAN.BASIC,
    tag: 'Gói khởi đầu',
    chip: 'Cơ bản',
    buttonText: 'Chọn gói Basic',
    hot: false,
  },
  {
    planCode: MEMBERSHIP_PLAN.PLUS,
    tag: 'Phổ biến nhất',
    chip: 'Được chọn nhiều',
    buttonText: 'Đăng ký gói Plus ngay',
    hot: true,
  },
];

// ----- Hàm hỗ trợ -----

// BE trả lỗi dạng ProblemDetail: câu giải thích nằm ở `detail`.
function problemMessage(err, fallback) {
  return err?.response?.data?.detail || extractErrorMessage(err, fallback);
}

// Gom offer theo planCode, giữ nguyên thứ tự BE trả về.
//
// BE có thể trả N offer cho CÙNG một planCode (mỗi offer là một mức giá /
// thời hạn khác nhau). Trước đây hàm này chỉ lấy offer ĐẦU TIÊN của mỗi
// plan nên các offer còn lại của cùng plan đó không bao giờ hiện ra ở
// Dashboard, dù chúng đang bán thật — đó là lý do "chỉ mua được 2 gói".
//
// Thứ tự BE trả về là planCode rồi durationDays tăng dần, nên offers[0] là
// mức thời hạn ngắn nhất và được dùng làm mặc định chọn.
function groupOffersByPlan(offers) {
  const groups = {};
  offers.forEach((offer) => {
    if (!groups[offer.planCode]) groups[offer.planCode] = [];
    groups[offer.planCode].push(offer);
  });
  return groups;
}

// BR-ACC-09: mục tiêu thể chất, liên hệ khẩn cấp là trường tùy chọn của Profile.
// BR-ACC-08: ảnh hồ sơ cần có trước lần check-in đầu tiên.
// Trả về danh sách thông tin còn thiếu để nhắc Member bổ sung.
function missingProfileFields(user) {
  const missing = [];
  if (!user?.profileImageUrl) missing.push('ảnh hồ sơ');
  if (!user?.fitnessGoal) missing.push('mục tiêu tập luyện');
  if (!user?.emergencyContactName || !user?.emergencyContactPhone) {
    missing.push('liên hệ khẩn cấp');
  }
  return missing;
}

// ----- Thành phần nhỏ -----

function Step({ state, label, title, text, here }) {
  return (
    <div className={`scms-md-step ${state}`}>
      <div className="scms-md-step-num">
        {state === 'done' ? <Icon name="check" /> : null}
        {state !== 'done' ? label.num : null}
      </div>
      <div>
        <span className="scms-md-step-label">
          {label.text}
          {here ? <span className="scms-md-here">Đang ở bước này</span> : null}
        </span>
        <span className="scms-md-step-title">{title}</span>
        <p>{text}</p>
      </div>
    </div>
  );
}

function PlanCard({ config, offers, blockedReason, busyOfferId, onChoose }) {
  const { hot, tag, chip, buttonText } = config;

  // Plan này chỉ có 1 mức giá -> giữ nguyên layout cũ, không cần bộ chọn.
  const list = offers || [];
  const hasVariants = list.length > 1;
  // Không dùng useState cho lựa chọn hiện tại: danh sách offer tới sau, nên
  // hook sẽ đổi số lần gọi giữa các render (vi phạm rules-of-hooks) và
  // state cũ còn sót lại khi BE đổi danh sách. Thay vào đó lưu offerId
  // của phiên bản đang bấm và fallback về offers[0] khi không còn hợp lệ.
  const [pickedOfferId, setPickedOfferId] = useState(null);
  const offer = list.find((o) => o.offerId === pickedOfferId) || list[0];
  const busy = Boolean(offer) && busyOfferId === offer.offerId;

  // Chưa có offer ACTIVE nào cho plan này.
  if (!offer) {
    return (
      <div className={`scms-md-plan${hot ? ' hot' : ''}`}>
        <div>
          <div className="scms-md-plan-top">
            <small>{tag}</small>
            <span className="scms-md-plan-chip">{chip}</span>
          </div>
          <div className="scms-md-plan-name">{config.planCode}</div>
          <p className="scms-md-plan-desc">Hiện chưa có gói nào đang mở bán.</p>
        </div>
        <button type="button" className="scms-md-plan-btn" disabled>
          {buttonText}
        </button>
      </div>
    );
  }

  // BR-PKG-01/02: BASIC dùng khu vực gym; PLUS thêm đặt lịch lớp và HLV cá nhân.
  const features = [
    { ok: true, text: 'Sử dụng khu vực gym & tập luyện tại trung tâm' },
    {
      ok: offer.supportsBooking,
      text: offer.supportsBooking
        ? 'Đặt lịch lớp Yoga / Group'
        : 'Chưa gồm đặt lịch lớp Yoga / Group',
    },
    {
      ok: offer.supportsPersonalCoaching,
      text: offer.supportsPersonalCoaching
        ? 'Huấn luyện viên cá nhân (PT 1-1) & Training'
        : 'Chưa gồm HLV cá nhân & Training',
    },
  ];

  return (
    <div className={`scms-md-plan${hot ? ' hot' : ''}`}>
      {hot ? <div className="scms-md-plan-ribbon">Gói khuyên dùng</div> : null}
      <div>
        <div className="scms-md-plan-top">
          <small>{tag}</small>
          <span className="scms-md-plan-chip">{chip}</span>
        </div>
        <div className="scms-md-plan-name">
          {offer.planDisplayName || offer.planCode}
        </div>

        {hasVariants ? (
          <div className="scms-md-plan-variants" role="radiogroup"
            aria-label={`Chọn mức giá gói ${config.planCode}`}>
            {list.map((item) => {
              const active = item.offerId === offer.offerId;
              return (
                <button
                  key={item.offerId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`scms-md-plan-variant${active ? ' on' : ''}`}
                  onClick={() => setPickedOfferId(item.offerId)}
                  disabled={Boolean(blockedReason)}
                >
                  <span className="scms-md-plan-variant-days">
                    {item.durationDays} ngày
                  </span>
                  <span className="scms-md-plan-variant-price">
                    {formatPrice(item.priceAmount, item.currencyCode)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="scms-md-plan-offer">{offer.name}</div>
        <div className="scms-md-plan-price">
          <strong>{formatPrice(offer.priceAmount, offer.currencyCode)}</strong>
          <span>/ {offer.durationDays} ngày</span>
        </div>
        {offer.description ? (
          <p className="scms-md-plan-desc">{offer.description}</p>
        ) : null}
        <ul className="scms-md-feat">
          {features.map((f) => (
            <li key={f.text} className={f.ok ? '' : 'off'}>
              <span className={f.ok ? 'yes' : 'no'}>
                <Icon name={f.ok ? 'checkCircle' : 'xCircle'} />
              </span>
              {f.text}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button
          type="button"
          className="scms-md-plan-btn"
          disabled={Boolean(blockedReason) || busy}
          onClick={() => onChoose(offer)}
        >
          {busy ? 'Đang tạo đơn...' : buttonText}
        </button>
        {blockedReason ? (
          <div className="scms-md-plan-note">{blockedReason}</div>
        ) : null}
      </div>
    </div>
  );
}

// ----- Trang chính -----

export default function MemberDashboardPage() {
  const { user } = useAuth();
  const {
    activeMembership,
    hasActiveMembership,
    loading: membershipLoading,
    error: membershipError,
    reload: reloadMemberships,
  } = useMemberArea();

  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState(null);

  const [pendingOrder, setPendingOrder] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [orderingId, setOrderingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refreshPending = useCallback(async () => {
    try {
      setPendingOrder(await getMyPendingMembershipOrder());
    } catch (err) {
      setActionError({
        message: problemMessage(err, 'Không tải được đơn chờ thanh toán.'),
      });
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listActiveOffers()
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch((err) => {
        if (!cancelled) setOffersError(err);
      })
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
    refreshPending();
    return () => {
      cancelled = true;
    };
  }, [refreshPending]);

  // BR-ORD-01: mua gói bắt đầu bằng một Order, quyền lợi chưa được cấp ngay.
  // BR-ORD-02/03: Member tự mua dùng Bank Transfer, Order ở PENDING_PAYMENT.
  async function handleChoose(offer) {
    setActionError(null);
    setNotice(null);
    setOrderingId(offer.offerId);
    try {
      const order = await createMyMembershipOrder({ offerId: offer.offerId });
      setPendingOrder(order);
      setNotice(
        `Đã tạo đơn ${order.orderNumber} cho gói ${order.offerName}. Đơn đang chờ thanh toán.`,
      );
    } catch (err) {
      // Luôn hiển thị lỗi BE trả về, ví dụ:
      //   BR-MEM-08: đã có Membership ACTIVE (ACTIVE_MEMBERSHIP_EXISTS)
      //   BR-ORD-07: đã có đơn PENDING_PAYMENT (PENDING_MEMBERSHIP_ORDER_EXISTS)
      setActionError({
        message: problemMessage(err, 'Không tạo được đơn mua gói.'),
      });
      if (err?.response?.status === 409) {
        // Trạng thái trên màn hình đã cũ -> đồng bộ lại với BE.
        refreshPending();
        reloadMemberships();
      }
    } finally {
      setOrderingId(null);
    }
  }

  // BR-MEM-08 và BR-ORD-07: chặn nút mua. BE vẫn kiểm tra lại (BR-SEC-04).
  let blockedReason = null;
  if (hasActiveMembership) blockedReason = 'Bạn đang có gói tập còn hiệu lực.';
  else if (pendingOrder) blockedReason = 'Bạn đang có một đơn chờ thanh toán.';
  else if (membershipLoading || pendingLoading) blockedReason = 'Đang tải...';

  const fullName = user?.fullName || 'hội viên';
  const missing = missingProfileFields(user);
  const groupedOffers = groupOffersByPlan(offers);

  // Huy hiệu trạng thái ở góc phải tiêu đề.
  let badgeText = 'Đang tải...';
  if (!membershipLoading && membershipError) badgeText = 'Không tải được gói tập';
  else if (!membershipLoading && hasActiveMembership) {
    const plan =
      activeMembership.plan_code_snapshot || activeMembership.planCode || '';
    badgeText = `Gói ${plan} đang hoạt động · đến ${formatDate(activeMembership.ends_at)}`;
  } else if (!membershipLoading) badgeText = 'Chưa kích hoạt gói tập';

  // Lộ trình: có gói tập thì đang ở bước 3, chưa có thì ở bước 2.
  const currentStep = hasActiveMembership ? 3 : 2;
  function stateOf(n) {
    if (n < currentStep) return 'done';
    if (n === currentStep) return 'current';
    return '';
  }

  return (
    <div className="scms-md">
      <div className="scms-md-top">
        <div>
          <div className="scms-md-crumb">
            <span>Trang chủ</span>
            <Icon name="chevron" size={14} />
            <span>Hội viên</span>
            <Icon name="chevron" size={14} />
            <strong>Trang tổng quan</strong>
          </div>
          <h1 className="scms-md-title">
            Chào mừng bạn đến với SCMS Sports Center, {fullName}!
          </h1>
        </div>
        <span className={`scms-md-badge${hasActiveMembership ? ' on' : ''}`}>
          <span className="scms-md-badge-dot" aria-hidden="true"></span>
          {badgeText}
        </span>
      </div>

      {missing.length > 0 ? (
        <div className="scms-md-banner">
          <div className="scms-md-banner-main">
            <div className="scms-md-banner-icon">
              <Icon name="alert" size={24} />
            </div>
            <div>
              <h3>
                Hồ sơ của bạn chưa hoàn thiện
                <span className="scms-md-tag">Cần thiết</span>
              </h3>
              <p>
                Bổ sung {missing.join(', ')} để huấn luyện viên hỗ trợ xây dựng
                giáo án tối ưu nhất.
              </p>
            </div>
          </div>
          <Link to="/member/profile" className="scms-md-btn-dark">
            <Icon name="edit" />
            Cập nhật thêm thông tin
          </Link>
        </div>
      ) : null}

      {pendingOrder ? (
        <div className="scms-md-banner pending">
          <div className="scms-md-banner-main">
            <div className="scms-md-banner-icon">
              <Icon name="clock" size={24} />
            </div>
            <div>
              <h3>Bạn có đơn đang chờ thanh toán</h3>
              <p>
                {pendingOrder.offerName} ({pendingOrder.planCode}) ·{' '}
                {formatPrice(pendingOrder.priceAmount, pendingOrder.currencyCode)}{' '}
                · {pendingOrder.durationDays} ngày · Mã đơn{' '}
                {pendingOrder.orderNumber} · Tạo lúc{' '}
                {formatDateTime(pendingOrder.createdAt)}. Chức năng thanh toán
                chuyển khoản sẽ được bổ sung ở bước tiếp theo.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="scms-md-grid">
        <div className="scms-md-col">
          <div className="scms-md-card">
            <div className="scms-md-card-head">
              <div className="scms-md-headrow">
                <span className="scms-md-headicon">
                  <Icon name="route" />
                </span>
                <div>
                  <h2>Lộ trình 4 bước bắt đầu trải nghiệm tại SCMS</h2>
                  <span className="sub">
                    Hướng dẫn từng bước nhanh chóng để bước vào phòng tập
                  </span>
                </div>
              </div>
              <span className="scms-md-pill">Bước {currentStep}/4</span>
            </div>

            <div className="scms-md-steps">
              <Step
                state={stateOf(1)}
                label={{ num: 1, text: 'Bước 1: Tạo tài khoản' }}
                title="Đăng ký & Xác thực (Đã hoàn tất)"
                text={`Mã số hội viên ${user?.memberId || ''} đã được khởi tạo thành công trên hệ thống SCMS.`}
              />
              <Step
                state={stateOf(2)}
                here={currentStep === 2}
                label={{ num: 2, text: 'Bước 2: Hoàn thiện thông tin & Chọn gói' }}
                title={
                  hasActiveMembership
                    ? 'Bạn đã có gói tập'
                    : 'Chọn gói tập phù hợp & Bổ sung mục tiêu'
                }
                text="Lựa chọn gói Basic hoặc Plus và cập nhật thể trạng, mục tiêu hiện tại."
              />
              <Step
                state={stateOf(3)}
                here={currentStep === 3}
                label={{ num: 3, text: 'Bước 3: Bắt đầu rèn luyện' }}
                title="Đo InBody & Gặp huấn luyện viên"
                text="Đánh giá chỉ số cơ mỡ chi tiết và tham gia buổi định hướng tập luyện đầu tiên."
              />
              <Step
                state={stateOf(4)}
                label={{ num: 4, text: 'Bước 4: Tập luyện và theo dõi kết quả' }}
                title="Theo dõi kết quả sau mỗi buổi tập"
                text="Có cập nhật thông báo sau mỗi buổi tập."
              />
            </div>
          </div>

          <div className="scms-md-card">
            <div className="scms-md-card-head">
              <div className="scms-md-headrow">
                <span className="scms-md-headicon">
                  <Icon name="star" />
                </span>
                <div>
                  <h2>Gói tập đề xuất cho bạn</h2>
                  <span className="sub">
                    Đăng ký ngay hôm nay để nhận hỗ trợ tập luyện từ HLV chuyên
                    nghiệp
                  </span>
                </div>
              </div>
              <Link to="/offers" className="scms-md-link">
                Tất cả gói tập <Icon name="arrow" size={16} />
              </Link>
            </div>

            {notice ? (
              <Alert
                variant="success"
                dismissible
                onClose={() => setNotice(null)}
                className="mb-0"
              >
                {notice}
              </Alert>
            ) : null}
            <ErrorAlert
              error={actionError}
              title="Không thực hiện được"
              onClose={() => setActionError(null)}
            />
            <ErrorAlert
              error={offersError}
              title="Không tải được danh sách gói tập"
            />

            {offersLoading ? (
              <div className="scms-md-center">
                <Spinner animation="border" variant="danger" />
              </div>
            ) : (
              <div className="scms-md-plans">
                {PLAN_CARDS.map((config) => (
                  <PlanCard
                    key={config.planCode}
                    config={config}
                    offers={groupedOffers[config.planCode] || []}
                    blockedReason={blockedReason}
                    busyOfferId={orderingId}
                    onChoose={handleChoose}
                  />
                ))}
              </div>
            )}

            <Link to="/offers" className="scms-md-all">
              <span className="scms-md-headrow">
                <span className="scms-md-all-icon">
                  <Icon name="table" size={22} />
                </span>
                <span>
                  <strong>Xem chi tiết tất cả gói tập & quyền lợi</strong>
                  <span>Bao gồm mọi gói đang mở bán với thời hạn khác nhau</span>
                </span>
              </span>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>

        <div className="scms-md-col">
          <div className="scms-md-card">
            <span className="scms-md-help-label">Cần hỗ trợ tư vấn gói?</span>
            <div className="scms-md-help">
              <span className="scms-md-help-icon">
                <Icon name="phone" />
              </span>
              <div>
                <small>Hotline tư vấn hội viên</small>
                <strong>1900 6868 (Phím 1)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
