import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { markAllNotificationsRead, markNotificationRead } from '../../services/notificationService';
import { formatGymDate, formatGymTime } from '../../utils/gymTime';
import { notificationDetail, notificationSummary } from '../../utils/notificationUi';

function notificationDestination(item, pathname) {
  const role = pathname.split('/')[1];
  const type = item.notificationType;
  const payload = item.payload || {};
  const sessionId = payload.sessionId || (item.targetType === 'CLASS_SESSION' ? item.targetId : null);

  if (role === 'member') {
    if (sessionId && ['BOOKING_CREATED', 'SESSION_ROOM_CHANGED', 'SESSION_RESCHEDULED'].includes(type)) {
      return `/member/class-sessions?sessionId=${encodeURIComponent(sessionId)}`;
    }
    if (['BOOKING_CANCELLED', 'SESSION_CANCELLED', 'PT_BOOKING_CANCELLED'].includes(type)) {
      return '/member/class-sessions';
    }
    if ([
      'COACH_ASSIGNED',
      'COACH_REASSIGNED',
      'COACH_ASSIGNMENT_ENDED',
      'TRAINING_COACH_ASSIGNED',
      'TRAINING_COACH_ENDED',
    ].includes(type)) {
      return '/member/dashboard#my-coach';
    }
    if (type === 'PAYMENT_PAID' || type?.startsWith('MEMBERSHIP_REFUND_')) {
      return '/member/receipts';
    }
    if (type?.startsWith('MEMBERSHIP_FREEZE_') || type?.startsWith('MEMBERSHIP_TERMINATION_')) {
      return '/member/membership-requests';
    }
    if ([
      'WAITLIST_PROMOTED',
      'WAITLIST_CANCELLED',
      'WAITLIST_SKIPPED',
      'WAITLIST_EXPIRED',
      'PT_WAITLIST_CANCELLED',
    ].includes(type)) {
      return '/member/class-sessions';
    }
    if (['ACCOUNT_CREATED', 'MEMBER_SUSPENDED', 'MEMBER_REACTIVATED'].includes(type)) {
      return '/member/profile';
    }
    return '/member/dashboard';
  }

  if (role === 'coach') {
    if (sessionId && ['SESSION_CANCELLED', 'SESSION_ROOM_CHANGED', 'SESSION_RESCHEDULED'].includes(type)) {
      return `/coach/schedule/${encodeURIComponent(sessionId)}`;
    }
    if (type === 'TRAINING_COACH_ASSIGNED' && payload.memberAccountId) {
      return `/coach/members/${encodeURIComponent(payload.memberAccountId)}`;
    }
    if (type === 'TRAINING_COACH_ENDED') return '/coach/members';
    return '/coach/dashboard';
  }

  if (role === 'reception') {
    if (type === 'MEMBERSHIP_FREEZE_PAYMENT_REQUIRED') return '/reception/membership-requests';
    if (type?.startsWith('MEMBERSHIP_REFUND_')) return '/reception/refunds';
    return '/reception/dashboard';
  }

  if (role === 'manager') {
    if (type === 'MANUAL_ACTIVATION_REVIEW_REQUIRED') return '/manager/email-verification';
    if (type?.startsWith('MEMBERSHIP_REFUND_')) return '/manager/refunds';
    if (type?.startsWith('MEMBERSHIP_FREEZE_') || type?.startsWith('MEMBERSHIP_TERMINATION_')) {
      return '/manager/membership-requests';
    }
    if (type?.startsWith('COACH_LEAVE_')) return '/manager/coach-leave-requests';
    return '/manager/dashboard';
  }

  return null;
}

export default function NotificationBellContent({
  notifications = [],
  unreadCount = 0,
  hasMore = false,
  loadingMore = false,
  loadMoreError = '',
  onLoadMore,
  classPrefix,
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');

  async function markRead(item) {
    if (item.read || busyId || markingAll) return;
    setBusyId(item.id);
    setError('');
    try {
      await markNotificationRead(item.id);
      window.dispatchEvent(new Event('scms:notifications-changed'));
    } catch {
      setError('Không thể cập nhật thông báo. Vui lòng thử lại.');
    } finally {
      setBusyId(null);
    }
  }

  async function openNotification(item) {
    const destination = notificationDestination(item, pathname);
    if (!destination || busyId || markingAll) return;
    setError('');

    if (!item.read) {
      setBusyId(item.id);
      try {
        await markNotificationRead(item.id);
        window.dispatchEvent(new Event('scms:notifications-changed'));
      } catch {
        setError('Không thể cập nhật thông báo. Vui lòng thử lại.');
        setBusyId(null);
        return;
      }
      setBusyId(null);
    }

    navigate(destination);
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAll || busyId) return;
    setMarkingAll(true);
    setError('');
    try {
      await markAllNotificationsRead();
      window.dispatchEvent(new Event('scms:notifications-changed'));
    } catch {
      setError('Không thể cập nhật thông báo. Vui lòng thử lại.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className={`${classPrefix}-bell-content`}>
      <div className={`${classPrefix}-bell-head`}>
        <span>Thông báo{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
        {unreadCount > 0 ? (
          <button
            type="button"
            className={`${classPrefix}-bell-mark-all`}
            disabled={markingAll || busyId != null}
            onClick={markAllRead}
          >
            {markingAll ? 'Đang cập nhật...' : 'Đọc tất cả'}
          </button>
        ) : null}
      </div>
      {error ? <div className={`${classPrefix}-bell-error`} role="alert">{error}</div> : null}
      {loadMoreError ? <div className={`${classPrefix}-bell-error`} role="alert">{loadMoreError}</div> : null}
      {notifications.length > 0 ? (
        <div className={`${classPrefix}-bell-list`}>
          {notifications.map((item) => (
            <div
              className={`${classPrefix}-bell-preview${item.read ? '' : ' is-unread'}`}
              key={item.id}
            >
              <button
                type="button"
                className={`${classPrefix}-bell-open`}
                onClick={() => openNotification(item)}
                disabled={markingAll || busyId != null}
                aria-label={`Mở thông báo: ${notificationSummary(item)}`}
              >
                <div className={`${classPrefix}-bell-copy`}>
                  <div className={`${classPrefix}-bell-summary`}>
                    {notificationSummary(item)}
                    {!item.read ? <span className={`${classPrefix}-bell-new`}>Mới</span> : null}
                  </div>
                  <div className={`${classPrefix}-bell-meta`}>
                    {formatGymDate(item.createdAt)} · {formatGymTime(item.createdAt)}
                  </div>
                  {notificationDetail(item) ? (
                    <div className={`${classPrefix}-bell-detail`}>{notificationDetail(item)}</div>
                  ) : null}
                </div>
              </button>
              {!item.read ? (
                <button
                  type="button"
                  className={`${classPrefix}-bell-mark-read`}
                  disabled={markingAll || busyId != null}
                  onClick={() => markRead(item)}
                  aria-label={`Đánh dấu đã đọc: ${notificationSummary(item)}`}
                >
                  {busyId === item.id ? 'Đang lưu...' : 'Đã đọc'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${classPrefix}-bell-empty`}>Chưa có thông báo nào.</div>
      )}
      {hasMore ? (
        <button
          type="button"
          className={`${classPrefix}-bell-load-more`}
          disabled={loadingMore || markingAll || busyId != null}
          onClick={onLoadMore}
        >
          {loadingMore ? 'Đang tải...' : 'Xem thông báo trước đó'}
        </button>
      ) : null}
    </div>
  );
}
