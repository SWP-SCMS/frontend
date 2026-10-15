// Ba thẻ dành cho hội viên đang có gói PLUS, thay cho "Lộ trình 4 bước" và
// "Gói tập đề xuất" trên trang tổng quan:
//   1. Thời gian còn lại của gói  : từ Membership ACTIVE (startsAt / endsAt)
//   2. Lịch tập sắp tới           : GET /members/me/bookings?status=BOOKED
//   3. Đánh giá của Coach         : GET /members/me/feedback (BR-FDB-02)

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listAllMyBookedBookings } from '../../../services/memberBookingService';
import { listMyFeedback } from '../../../services/memberFeedbackService';
import { formatDate, formatDateTime } from '../../../utils';
import {
  formatGymDate,
  formatGymTime,
} from '../../../utils/gymTime';
import './PlusDashboardPanels.css';

const MAX_UPCOMING = 5;
const MAX_FEEDBACK = 3;
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

// Khung xám thay cho nội dung (không dùng dữ liệu giả) + ghi chú mở khóa.
function LockedBody() {
  return (
    <>
      <ul className="scms-pd-list" aria-hidden="true">
        <li>
          <span className="scms-pd-skel" style={{ width: 70 }} />
          <span className="scms-pd-skel" style={{ flex: 1 }} />
        </li>
        <li>
          <span className="scms-pd-skel" style={{ width: 70 }} />
          <span className="scms-pd-skel" style={{ flex: 1 }} />
        </li>
      </ul>
      <div className="scms-pd-lock">
        <strong>Bạn cần tham gia gói Plus để mở khóa tính năng này</strong>
        <Link to="/member/plan" className="scms-md-link">
          Xem gói tập
        </Link>
      </div>
    </>
  );
}

// Hội viên gói BASIC (locked): thẻ Lịch tập sắp tới và Đánh giá của Coach bị mờ
// kèm ghi chú cần gói PLUS; không gọi API của hai thẻ đó (BR-BKG-03/05, BR-COA-01).
export default function PlusDashboardPanels({ membership, locked = false }) {
  const [bookings, setBookings] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(!locked);
  const [error, setError] = useState(null);
  const [now] = useState(() => Date.now()); // mốc "bây giờ" lúc mở trang

  useEffect(() => {
    if (locked) return undefined;
    let cancelled = false;
    // Hai API độc lập: một cái lỗi thì cái kia vẫn hiện.
    Promise.allSettled([listAllMyBookedBookings(), listMyFeedback()]).then(
      ([b, f]) => {
        if (cancelled) return;
        if (b.status === 'fulfilled') setBookings(b.value);
        if (f.status === 'fulfilled') setFeedback(f.value);
        const failed = [b, f].find((r) => r.status === 'rejected');
        if (failed) setError(failed.reason);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [locked]);

  // Buổi chưa kết thúc, sớm nhất trước.
  const upcoming = useMemo(() => {
    return bookings
      .filter((b) => new Date(b.endTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, MAX_UPCOMING);
  }, [bookings, now]);

  // Feedback chỉ có classSessionId: tra tên lớp từ các buổi đã đặt.
  const bookingBySession = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => map.set(b.sessionId, b));
    return map;
  }, [bookings]);

  const latestFeedback = useMemo(
    () =>
      [...feedback]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, MAX_FEEDBACK),
    [feedback],
  );

  const time = planTime(membership);
  const endsAt = pick(membership, 'ends_at', 'endsAt');

  return (
    <>
      <div className="scms-md-card">
        <div className="scms-md-card-head">
          <div>
            <h2>Thời gian còn lại của gói</h2>
            <span className="sub">
              Gói {pick(membership, 'plan_code_snapshot', 'planCode') || 'PLUS'}
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
      </div>

      <ErrorAlert
        error={error}
        title="Không tải được một phần dữ liệu"
        onClose={() => setError(null)}
      />

      <div className={`scms-md-card${locked ? " scms-pd-locked" : ""}`}>
        <div className="scms-md-card-head">
          <div>
            <h2>Lịch tập sắp tới</h2>
            <span className="sub">Các buổi bạn đã đăng ký</span>
          </div>
          <Link to="/member/class-sessions" className="scms-md-link">
            Xem tất cả lịch
          </Link>
        </div>
        {locked ? (
          <LockedBody />
        ) : loading ? (
          <div className="scms-md-center">
            <Spinner animation="border" variant="danger" />
          </div>
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
                    {b.coachName || '—'} · {b.roomName || '—'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`scms-md-card${locked ? " scms-pd-locked" : ""}`}>
        <div className="scms-md-card-head">
          <div>
            <h2>Đánh giá của Coach</h2>
            <span className="sub">Nhận xét mới nhất dành cho bạn</span>
          </div>
        </div>
        {locked ? (
          <LockedBody />
        ) : loading ? (
          <div className="scms-md-center">
            <Spinner animation="border" variant="danger" />
          </div>
        ) : latestFeedback.length === 0 ? (
          <div className="scms-pd-muted">Coach chưa gửi đánh giá nào.</div>
        ) : (
          <ul className="scms-pd-list">
            {latestFeedback.map((f) => {
              const session = bookingBySession.get(f.classSessionId);
              return (
                <li key={f.id} className="scms-pd-feedback">
                  <div className="scms-pd-muted">
                    {session?.className ? `${session.className} · ` : ''}
                    {formatDateTime(f.createdAt)}
                  </div>
                  <div>{f.content}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
