// Lịch sử gói tập của chính Hội viên (US21 · Membership History).
//
// Dữ liệu: GET /members/me/memberships — danh sách Membership đã mua, mới nhất
// trước, mỗi bản ghi có:
//   id, order_id, plan_code_snapshot, offer_name_snapshot, price_amount_snapshot,
//   currency_code_snapshot, duration_days_snapshot, status, starts_at, ends_at
//
// RESERVED là gói gia hạn đã thanh toán, chưa có startsAt/endsAt cho tới khi
// gói ACTIVE hiện tại hết hạn và backend tự kích hoạt.
//
// Hợp đồng hiện tại trả record camelCase. `pick()` vẫn chấp nhận snake_case để
// dữ liệu cũ hoặc môi trường chưa cập nhật không làm hỏng giao diện.

import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { formatDate, formatPrice } from '../../../utils';
import { hasBenefitContract } from '../../../utils/membershipBenefits';
import './MembershipHistoryPage.css';

// Đọc một trường, chấp nhận cả snake_case (BE hiện tại) lẫn camelCase
// (nếu endpoint đổi sang record sau này).
function pick(row, snake, camel) {
  return row[snake] ?? row[camel] ?? null;
}

const PLAN_LABELS = {
  BASIC: 'Basic',
  PLUS: 'Plus',
};

// Contract vòng đời gói tập hiện tại.
const STATUS_LABELS = {
  RESERVED: 'Chờ kích hoạt',
  ACTIVE: 'Đang hoạt động',
  EXPIRED: 'Đã hết hạn',
  TERMINATED: 'Đã chấm dứt',
};

function formatPeriod(startsAt, endsAt, status) {
  if (status === 'RESERVED') return 'Sau khi gói hiện tại kết thúc';
  const from = formatDate(startsAt);
  const to = formatDate(endsAt);
  if (from === '—' && to === '—') return '—';
  return `${from} — ${to}`;
}

export default function MembershipHistoryPage() {
  // MemberLayout đã tải sẵn danh sách Membership qua useMemberArea và giữ
  // trong suốt điều hướng, nên trang này dùng chung thay vì gọi API lần nữa.
  const { memberships, loading, error, reload } = useMemberArea();

  const rows = memberships ?? [];

  if (loading) {
    return (
      <div className="scms-mh">
        <div className="scms-mh-loading">
          <Spinner animation="border" size="sm" /> Đang tải lịch sử thanh toán…
        </div>
      </div>
    );
  }

  return (
    <div className="scms-mh">
      <div className="scms-mh-top">
        <div>
          <div className="scms-mh-crumb">
            <span>Trang chủ</span>
            <span className="scms-mh-crumb-sep">›</span>
            <span>Hội viên</span>
            <span className="scms-mh-crumb-sep">›</span>
            <strong>Lịch sử thanh toán</strong>
          </div>
          <h1 className="scms-mh-title">Lịch sử thanh toán</h1>
          <p className="scms-mh-sub">
            Toàn bộ gói tập bạn đã đăng ký, mới nhất trước.
          </p>
        </div>
        {rows.length > 0 ? (
          <button type="button" className="scms-mh-reload" onClick={reload}>
            Tải lại
          </button>
        ) : null}
      </div>

      <ErrorAlert error={error} title="Không tải được lịch sử thanh toán" />

      {rows.length === 0 ? (
        error ? null : (
          <div className="scms-mh-empty">
            <span className="scms-mh-empty-icon" aria-hidden="true">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                <path d="M9 7h6M9 11h6M9 15h4" />
              </svg>
            </span>
            <h2>Bạn chưa có gói tập nào</h2>
            <p>
              Khi bạn đăng ký gói tập đầu tiên, lịch sử sẽ hiển thị tại đây.
            </p>
            <Link
              to="/member/plan#member-offers"
              className="scms-mh-empty-cta"
            >
              Xem các gói tập
            </Link>
          </div>
        )
      ) : (
        <div className="scms-mh-card">
          <div className="scms-mh-tablewrap">
            <table className="scms-mh-table">
              <caption className="visually-hidden">
                Lịch sử thanh toán các gói tập đã đăng ký
              </caption>
              <thead>
                <tr>
                  <th scope="col">Gói tập</th>
                  <th scope="col">Thời hạn</th>
                  <th scope="col">Giá</th>
                  <th scope="col">Quyền lợi</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const planCode = pick(row, 'plan_code_snapshot', 'planCode');
                  const offerName = pick(row, 'offer_name_snapshot', 'offerName');
                  const priceAmount = pick(
                    row,
                    'price_amount_snapshot',
                    'priceAmount',
                  );
                  const currencyCode = pick(
                    row,
                    'currency_code_snapshot',
                    'currencyCode',
                  );
                  const durationDays = pick(
                    row,
                    'duration_days_snapshot',
                    'durationDays',
                  );
                  const startsAt = pick(row, 'starts_at', 'startsAt');
                  const endsAt = pick(row, 'ends_at', 'endsAt');
                  const statusClass = String(row.status || '').toLowerCase();

                  return (
                    <tr key={row.id ?? `${offerName}-${startsAt}`}>
                      <td>
                        <div className="scms-mh-plan">{offerName || '—'}</div>
                        <div className="scms-mh-plancode">
                          {PLAN_LABELS[planCode] || planCode || '—'}
                          {durationDays != null ? (
                            <span className="scms-mh-days">
                              {' '}
                              · {durationDays} ngày
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="scms-mh-period" data-label="Thời hạn">
                        {formatPeriod(startsAt, endsAt, row.status)}
                      </td>
                      <td className="scms-mh-price" data-label="Giá">
                        {formatPrice(priceAmount, currencyCode || 'VND')}
                      </td>
                      <td data-label="Quyền lợi">
                        <MembershipBenefitList
                          benefitCodes={row.benefitCodes ?? row.benefit_codes}
                          benefits={row.benefits}
                          emptyMessage={
                            hasBenefitContract(row)
                              ? 'Không có quyền lợi'
                              : 'Chưa có dữ liệu quyền lợi'
                          }
                        />
                      </td>
                      <td data-label="Trạng thái">
                        <span
                          className={`scms-mh-status ${statusClass}`}
                        >
                          {STATUS_LABELS[row.status] || row.status || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
