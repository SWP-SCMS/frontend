import useCachedPollingEffect from '../../../hooks/useCachedPollingEffect';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import { listAllMyBookedBookings } from '../../../services/memberBookingService';
import { listMyCourseEnrollments } from '../../../services/courseEnrollmentService';
import { courseScheduleEntries } from '../../../utils/courseWorkflow';
import { formatDate } from '../../../utils';
import { hasBenefitContract } from '../../../utils/membershipBenefits';
import {
  formatGymDate,
  formatGymTime,
} from '../../../utils/gymTime';
import './MemberServiceDashboardPanels.css';

const MAX_UPCOMING = 5;
const DAY_MS = 86_400_000;

// BE trả camelCase; giữ fallback snake_case cho bản cũ (giống MyPlanPage).
function pick(row, snake, camel) {
  return row?.[camel] ?? row?.[snake] ?? null;
}

// Số ngày còn lại và phần trăm thời gian đã dùng của gói.
function planTime(membership) {
  const start = new Date(pick(membership, 'starts_at', 'startsAt')).getTime();
  const end = new Date(pick(membership, 'ends_at', 'endsAt')).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const now = Date.now();
  return {
    daysLeft: Math.max(0, Math.ceil((end - now) / DAY_MS)),
    percent: Math.round(
      Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
    ),
  };
}

export default function MemberServiceDashboardPanels({ membership }) {
  const [bookings, setBookings] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState(null);
  const [now] = useState(() => Date.now()); // mốc "bây giờ" lúc mở trang

  useCachedPollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(Promise.all([
      listAllMyBookedBookings(),
      listMyCourseEnrollments(),
    ]).then(([booked, courses]) => {
      const value = [...booked, ...courseScheduleEntries(courses)];
      commitValue(setBookings, value);
    }).catch(err => {
      failed(err);
      commitError(setScheduleError, err);
    }).finally(() => {
      if (!background) commitValue(setScheduleLoading, false);
    }));
  }, [], { key: ['member-schedule'], setters: [setBookings], setLoading: setScheduleLoading });

  // Buổi chưa kết thúc, sớm nhất trước.
  const upcoming = useMemo(() => {
    return bookings
      .filter((b) => new Date(b.endTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, MAX_UPCOMING);
  }, [bookings, now]);

  const time = planTime(membership);
  const endsAt = pick(membership, 'ends_at', 'endsAt');

  return (
    <>
      <div className="scms-md-card">
        <div className="scms-md-card-head">
          <div>
            <h2>Thời gian còn lại của gói</h2>
            <span className="sub">
              Gói {pick(membership, 'plan_code_snapshot', 'planCode') || '—'}
            </span>
          </div>
        </div>
        {time ? (
          <div>
            <div className="scms-pd-days">
              {time.daysLeft} <small>ngày</small>
            </div>
            <div
              className="scms-pd-bar"
              role="progressbar"
              aria-valuenow={time.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${time.percent}%` }} />
            </div>
            <div className="scms-pd-muted">
              Hết hạn ngày {formatDate(endsAt)} · đã dùng {time.percent}%
            </div>
          </div>
        ) : (
          <div className="scms-pd-muted">Chưa có thông tin thời hạn gói.</div>
        )}
        <div className="mt-3 pt-3 border-top">
          <div className="small fw-semibold mb-2">Quyền lợi đang có</div>
          <MembershipBenefitList
            benefitCodes={membership?.benefitCodes}
            benefits={membership?.benefits}
            emptyMessage={
              hasBenefitContract(membership)
                ? 'Gói hiện tại không có quyền lợi được cấu hình.'
                : 'Chưa có dữ liệu quyền lợi từ hệ thống.'
            }
          />
        </div>
      </div>

      <div className="scms-md-card">
        <div className="scms-md-card-head">
          <div>
            <h2>Lịch tập sắp tới</h2>
            <span className="sub">Các buổi bạn đã đăng ký</span>
          </div>
          <Link to="/member/class-sessions" className="scms-md-link">
            Xem tất cả lịch
          </Link>
        </div>
        {scheduleLoading ? (
          <div className="scms-md-center">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : scheduleError ? (
          <ErrorAlert error={scheduleError} title="Không tải được lịch tập" />
        ) : upcoming.length === 0 ? (
          <div className="scms-pd-muted">
            Bạn chưa có buổi tập nào sắp tới.{' '}
            <Link to="/member/class-booking">Đăng ký lớp</Link>
          </div>
        ) : (
          <ul className="scms-pd-list">
            {upcoming.map((b) => (
              <li key={b.bookingId ?? b.sessionId}>
                <div className="scms-pd-when">
                  <strong>{formatGymTime(b.startTime)}</strong>
                  <span>{formatGymDate(b.startTime)}</span>
                </div>
                <div>
                  <div className="scms-pd-title">{b.className || '—'}</div>
                  <div className="scms-pd-muted">
                    {b.classType === 'COURSE' ? <Link to="/member/courses">Khóa học · Xem chi tiết</Link> : <>{b.coachName || '—'} · {b.roomName || '—'}</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
