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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import MemberOfferSection from './MemberOfferSection';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { getMyPendingMembershipOrder } from '../../../services/memberService';
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
  PREMIUM: 'Premium',
};

const STATUS_LABELS = {
  RESERVED: 'Chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  EXPIRED: 'Đã hết hạn',
  TERMINATED: 'Đã chấm dứt',
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
  const {
    memberships,
    activeMembership,
    reservedMembership,
    loading,
    error,
    reload,
  } = useMemberArea();
  const [pendingOrder, setPendingOrder] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyPendingMembershipOrder()
      .then((order) => {
        if (!cancelled) setPendingOrder(order);
      })
      .catch(() => {
        // BE vẫn kiểm tra khi tạo đơn; lỗi đọc đơn chờ không nên khóa cả trang.
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {!activeMembership && !reservedMembership ? (
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
        <div className="scms-my-plan-stack">
          {activeMembership ? (
            <PlanCard membership={activeMembership} kind="active" />
          ) : null}
          {reservedMembership ? (
            <PlanCard membership={reservedMembership} kind="reserved" />
          ) : null}
        </div>
      )}

      {/* ACTIVE vẫn được mua một lần để gia hạn. Chỉ khóa khi đã có gói chờ
          kích hoạt hoặc còn một đơn chờ thanh toán. */}
      <MemberOfferSection
        blockedReason={
          reservedMembership
            ? 'Bạn đã có một gói gia hạn đang chờ kích hoạt. Bạn chỉ có thể mua tiếp sau khi gói đó được kích hoạt.'
            : pendingOrder
              ? `Bạn đang có đơn ${pendingOrder.orderNumber} chờ thanh toán. Hãy hoàn tất đơn đó trước.`
              : pendingLoading
                ? 'Đang kiểm tra đơn chờ thanh toán...'
                : null
        }
      />
    </div>
  );
}

function PlanCard({ membership, kind }) {
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

  const progress = usage(membership);
  const isActive = membership.status === 'ACTIVE';
  const isReserved = membership.status === 'RESERVED';
  const benefitTitleId = `plan-benefits-${membership.id || kind}`;

  return (
    <div className="scms-my-plan-card">
      <div className="scms-my-plan-head">
        <div>
          <span className="scms-my-plan-kicker">
            {isReserved ? 'Gói kế tiếp' : 'Gói đang dùng'}
          </span>
          <h2 className="scms-my-plan-name">
            {offerName || PLAN_LABELS[planCode] || planCode || '—'}
          </h2>
          <p className="scms-my-plan-tag">
            {PLAN_LABELS[planCode] || planCode || '—'}
            {durationDays != null ? ` · ${durationDays} ngày` : ''}
          </p>
        </div>
        <span
          className={`scms-my-plan-status${isActive ? ' on' : ''}${
            isReserved ? ' reserved' : ''
          }`}
        >
          <span className="scms-my-plan-status-dot" aria-hidden="true" />
          {STATUS_LABELS[membership.status] || membership.status || '—'}
        </span>
      </div>

      {isReserved ? (
        <div className="scms-my-plan-reserved-note">
          Gói này đã được thanh toán và sẽ tự động kích hoạt ngay sau khi gói
          hiện tại kết thúc. Ngày bắt đầu và kết thúc sẽ được xác định lúc đó.
        </div>
      ) : progress ? (
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
        <Detail
          label="Ngày bắt đầu"
          value={isReserved ? 'Chờ kích hoạt' : formatDate(startsAt)}
        />
        <Detail
          label="Ngày kết thúc"
          value={isReserved ? 'Chưa xác định' : formatDate(endsAt)}
        />
        <Detail
          label="Thời hạn"
          value={durationDays != null ? `${durationDays} ngày` : '—'}
        />
        <Detail
          label="Giá đã thanh toán"
          value={formatPrice(priceAmount, currencyCode || 'VND')}
        />
        <Detail
          label="Trạng thái"
          value={STATUS_LABELS[membership.status] || membership.status || '—'}
        />
      </dl>

      <section className="scms-my-plan-benefits" aria-labelledby={benefitTitleId}>
        <h3 id={benefitTitleId}>
          {isReserved ? 'Quyền lợi sẽ được kích hoạt' : 'Quyền lợi đang có'}
        </h3>
        <MembershipBenefitList
          benefitCodes={membership.benefitCodes ?? membership.benefit_codes}
          benefits={membership.benefits}
          emptyMessage={
            hasBenefitContract(membership)
              ? 'Gói hiện tại không có quyền lợi được cấu hình.'
              : 'Chưa có dữ liệu quyền lợi từ hệ thống.'
          }
        />
      </section>

      <div className="scms-my-plan-actions">
        {isActive ? (
          <Link to="/member/membership-requests" className="scms-my-plan-btn ghost">
            Đóng băng / hủy gói
          </Link>
        ) : null}
        {!isReserved ? (
          <a href="#member-offers" className="scms-my-plan-btn ghost">
            Nâng cấp / gia hạn
          </a>
        ) : null}
        <Link to="/member/memberships" className="scms-my-plan-btn">
          Xem lịch sử thanh toán
        </Link>
      </div>
    </div>
  );
}
