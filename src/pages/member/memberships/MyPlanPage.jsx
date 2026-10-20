// Gói tập hiện tại của Hội viên — xem sau khi đăng ký thành công.
//
// Dữ liệu: dùng chung useMemberArea() (MemberLayout tải sẵn từ
// GET /members/me/memberships), nên trang này không gọi API riêng.
//
// BR-MEM-04/05: Membership hết hạn chuyển EXPIRED và không dùng lại. Vì vậy
// "gói của tôi" là Membership ACTIVE mới nhất; nếu không còn gói ACTIVE thì
// hiện trạng thái chưa có gói kèm lối vào trang gói tập.
//
// Hợp đồng hiện tại trả record camelCase. `pick()` vẫn chấp nhận snake_case để
// dữ liệu cũ hoặc môi trường chưa cập nhật không làm hỏng giao diện.

import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import MemberOfferSection from './MemberOfferSection';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { formatDate, formatPrice } from '../../../utils';
import { hasBenefitContract } from '../../../utils/membershipBenefits';
import './MyPlanPage.css';
// Đọc một trường, chấp nhận cả snake_case (BE hiện tại) lẫn camelCase.
function pick(row, snake, camel) {
  return row[snake] ?? row[camel] ?? null;
}

const PLAN_LABELS = {
  BASIC: 'Basic',
  PLUS: 'Plus',
};

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  EXPIRED: 'Đã hết hạn',
};

// Tính tiến độ dùng gói (0–100) và số ngày còn lại.
// Membership luôn có starts_at/ends_at nên không cần fallback theo duration.
function usage(membership) {
  const startsAt = pick(membership, 'starts_at', 'startsAt');
  const endsAt = pick(membership, 'ends_at', 'endsAt');
  if (!startsAt || !endsAt) return null;

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;

  const now = Date.now();
  const percent = Math.min(
    100,
    Math.max(0, ((now - start) / (end - start)) * 100),
  );
  return {
    percent: Math.round(percent),
    daysLeft: Math.max(0, Math.ceil((end - now) / 86_400_000)),
  };
}

function Detail({ label, value }) {
  return (
    <div className="scms-my-dl-item">
      <span className="scms-my-dl-label">{label}</span>
      <span className="scms-my-dl-value">{value}</span>
    </div>
  );
}

export default function MyPlanPage() {
  const { memberships, activeMembership, loading, error, reload } =
    useMemberArea();

  if (loading) {
    return (
      <div className="scms-my-plan">
        <div className="scms-my-plan-loading">
          <Spinner animation="border" size="sm" /> Đang tải gói tập…
        </div>
      </div>
    );
  }

  const hasAny = (memberships ?? []).length > 0;

  return (
    <div className="scms-my-plan">
      <div className="scms-my-plan-top">
        <div>
          <div className="scms-my-plan-crumb">
            <span>Trang chủ</span>
            <span className="scms-my-plan-crumb-sep">›</span>
            <span>Hội viên</span>
            <span className="scms-my-plan-crumb-sep">›</span>
            <strong>Gói tập</strong>
          </div>
          <h1 className="scms-my-plan-title">Gói tập</h1>
          <p className="scms-my-plan-sub">
            Thông tin gói tập bạn đang sử dụng tại SCMS.
          </p>
        </div>
        <button type="button" className="scms-my-plan-reload" onClick={reload}>
          Tải lại
        </button>
      </div>

      <ErrorAlert error={error} title="Không tải được gói tập" />

      {!activeMembership ? (
        error ? null : (
          <div className="scms-my-plan-notice">
            <h2>
              {hasAny ? 'Gói tập của bạn đã hết hạn' : 'Bạn chưa có gói tập'}
            </h2>
            <p>
              {hasAny
                ? 'Hãy đăng ký gói mới để tiếp tục sử dụng khu vực tập luyện.'
                : 'Đăng ký gói tập đầu tiên để bắt đầu tập luyện tại SCMS.'}
            </p>
          </div>
        )
      ) : (
        <PlanCard membership={activeMembership} />
      )}

      {/* BR-MEM-08: đang có gói ACTIVE thì chưa mua được gói mới. */}
      <MemberOfferSection
        blockedReason={
          activeMembership
            ? 'Bạn đang có gói tập còn hiệu lực. Bạn có thể đăng ký gói mới sau khi gói hiện tại hết hạn.'
            : null
        }
      />
    </div>
  );
}

function PlanCard({ membership }) {
  const planCode = pick(membership, 'plan_code_snapshot', 'planCode');
  const offerName = pick(membership, 'offer_name_snapshot', 'offerName');
  const priceAmount = pick(membership, 'price_amount_snapshot', 'priceAmount');
  const currencyCode = pick(
    membership,
    'currency_code_snapshot',
    'currencyCode',
  );
  const durationDays = pick(
    membership,
    'duration_days_snapshot',
    'durationDays',
  );
  const startsAt = pick(membership, 'starts_at', 'startsAt');
  const endsAt = pick(membership, 'ends_at', 'endsAt');
  const orderId = pick(membership, 'order_id', 'orderId');

  const progress = usage(membership);
  const isActive = membership.status === 'ACTIVE';

  return (
    <div className="scms-my-plan-card">
      <div className="scms-my-plan-head">
        <div>
          <span className="scms-my-plan-kicker">Gói đang dùng</span>
          <h2 className="scms-my-plan-name">
            {offerName || PLAN_LABELS[planCode] || planCode || '—'}
          </h2>
          <p className="scms-my-plan-tag">
            {PLAN_LABELS[planCode] || planCode || '—'}
            {durationDays != null ? ` · ${durationDays} ngày` : ''}
          </p>
        </div>
        <span className={`scms-my-plan-status${isActive ? ' on' : ''}`}>
          <span className="scms-my-plan-status-dot" aria-hidden="true" />
          {STATUS_LABELS[membership.status] || membership.status || '—'}
        </span>
      </div>

      {progress ? (
        <div className="scms-my-plan-progress">
          <div className="scms-my-plan-progress-meta">
            <span>Đã dùng {progress.percent}%</span>
            <span>Còn {progress.daysLeft} ngày</span>
          </div>
          <div
            className="scms-my-plan-bar"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ sử dụng gói tập"
          >
            <div
              className="scms-my-plan-bar-fill"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
          <div className="scms-my-plan-progress-foot">
            <span>{formatDate(startsAt)}</span>
            <span>{formatDate(endsAt)}</span>
          </div>
        </div>
      ) : null}

      <dl className="scms-my-dl">
        <Detail label="Ngày bắt đầu" value={formatDate(startsAt)} />
        <Detail label="Ngày kết thúc" value={formatDate(endsAt)} />
        <Detail
          label="Thời hạn"
          value={durationDays != null ? `${durationDays} ngày` : '—'}
        />
        <Detail
          label="Giá đã thanh toán"
          value={formatPrice(priceAmount, currencyCode || 'VND')}
        />
        <Detail label="Mã đơn" value={orderId || '—'} />
        <Detail
          label="Trạng thái"
          value={STATUS_LABELS[membership.status] || membership.status || '—'}
        />
      </dl>

      <section className="scms-my-plan-benefits" aria-labelledby="current-plan-benefits">
        <h3 id="current-plan-benefits">Quyền lợi đang có</h3>
        <MembershipBenefitList
          benefitCodes={membership.benefitCodes ?? membership.benefit_codes}
          benefits={membership.benefits}
          showDescription
          emptyMessage={
            hasBenefitContract(membership)
              ? 'Gói hiện tại không có quyền lợi được cấu hình.'
              : 'Chưa có dữ liệu quyền lợi từ hệ thống.'
          }
        />
      </section>

      <div className="scms-my-plan-actions">
        <a href="#member-offers" className="scms-my-plan-btn ghost">
          Nâng cấp / gia hạn
        </a>
        <Link to="/member/memberships" className="scms-my-plan-btn">
          Xem lịch sử thanh toán
        </Link>
      </div>
    </div>
  );
}
