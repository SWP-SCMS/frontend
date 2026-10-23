import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';

import ErrorAlert from '../../components/common/ErrorAlert';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService';
import { formatGymDate, formatGymTime } from '../../utils/gymTime';

const TYPE_LABELS = {
  BOOKING_CREATED: 'Đặt lịch tập thành công',
  BOOKING_CANCELLED: 'Lịch đặt đã bị hủy',
  SESSION_CANCELLED: 'Buổi tập đã bị hủy',
  SESSION_ROOM_CHANGED: 'Buổi tập đã đổi phòng',
  SESSION_RESCHEDULED: 'Buổi tập đã đổi lịch',
  COACH_ASSIGNED: 'Đã phân công huấn luyện viên',
  COACH_REASSIGNED: 'Đã thay đổi huấn luyện viên',
  COACH_ASSIGNMENT_ENDED: 'Phân công huấn luyện viên đã kết thúc',
  TRAINING_COACH_ASSIGNED: 'Đã phân công huấn luyện viên',
  TRAINING_COACH_ENDED: 'Phân công huấn luyện viên đã kết thúc',
  PAYMENT_PAID: 'Thanh toán thành công',
  ACCOUNT_CREATED: 'Tài khoản đã được tạo',
  MEMBER_SUSPENDED: 'Tài khoản đã bị tạm khóa',
  MEMBER_REACTIVATED: 'Tài khoản đã được mở lại',
  MEMBERSHIP_FREEZE_REVIEW_REQUIRED: 'Có yêu cầu đóng băng cần duyệt',
  MEMBERSHIP_FREEZE_PAYMENT_REQUIRED: 'Có yêu cầu đóng băng cần thu phí',
  MEMBERSHIP_FREEZE_PENDING: 'Đã tạo yêu cầu đóng băng',
  MEMBERSHIP_FREEZE_APPROVED_PENDING_PAYMENT: 'Yêu cầu đóng băng đã được duyệt',
  MEMBERSHIP_FREEZE_SCHEDULED: 'Đã lên lịch đóng băng',
  MEMBERSHIP_FREEZE_ACTIVE: 'Gói tập đã bắt đầu đóng băng',
  MEMBERSHIP_FREEZE_COMPLETED: 'Đã hoàn tất đóng băng gói tập',
  MEMBERSHIP_FREEZE_ENDED_EARLY: 'Đã kết thúc đóng băng sớm',
  MEMBERSHIP_FREEZE_WITHDRAWN: 'Yêu cầu đóng băng đã được rút',
  MEMBERSHIP_TERMINATION_REVIEW_REQUIRED: 'Có yêu cầu hủy gói cần duyệt',
  MEMBERSHIP_TERMINATION_REQUESTED: 'Đã tạo yêu cầu hủy gói',
  MEMBERSHIP_TERMINATION_APPROVED: 'Yêu cầu hủy gói đã được duyệt',
  MEMBERSHIP_TERMINATION_REJECTED: 'Yêu cầu hủy gói bị từ chối',
  MEMBERSHIP_TERMINATION_WITHDRAWN: 'Yêu cầu hủy gói đã được rút',
  MEMBERSHIP_TERMINATION_EXECUTED: 'Gói tập đã được hủy',
  COACH_LEAVE_REQUESTED: 'Có yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_WITHDRAWN: 'Huấn luyện viên đã rút yêu cầu nghỉ',
  COACH_LEAVE_APPROVED: 'Yêu cầu nghỉ đã được duyệt',
  COACH_LEAVE_REJECTED: 'Yêu cầu nghỉ bị từ chối',
  WAITLIST_PROMOTED: 'Bạn đã được chuyển từ hàng chờ sang lịch đặt',
  WAITLIST_CANCELLED: 'Hàng chờ của buổi tập đã bị hủy',
  MEMBERSHIP_REFUND_REQUESTED: 'Đã tạo yêu cầu hoàn tiền',
  MEMBERSHIP_REFUND_FIRST_APPROVED: 'Yêu cầu hoàn tiền đã được duyệt bước đầu',
  MEMBERSHIP_REFUND_CASH_DISBURSED: 'Đã ghi nhận giao tiền hoàn',
  MEMBERSHIP_REFUND_COMPLETED: 'Yêu cầu hoàn tiền đã hoàn tất',
  MEMBERSHIP_REFUND_REJECTED: 'Yêu cầu hoàn tiền bị từ chối',
};

const TARGET_LABELS = {
  CLASS_SESSION: 'Buổi tập',
  BOOKING: 'Lịch đặt',
  COACH_ASSIGNMENT: 'Phân công huấn luyện viên',
  PAYMENT: 'Thanh toán',
  MEMBERSHIP: 'Gói tập',
  MEMBERSHIP_FREEZE_REQUEST: 'Yêu cầu đóng băng',
  MEMBERSHIP_TERMINATION_REQUEST: 'Yêu cầu hủy gói',
  COACH_LEAVE_REQUEST: 'Yêu cầu nghỉ HLV',
  REFUND_REQUEST: 'Yêu cầu hoàn tiền',
};

function humanize(value) {
  if (!value) return '';
  const text = String(value).replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
}

function notificationSummary(item) {
  const payload = item.payload || {};
  return payload.message || payload.className || payload.memberName ||
    TYPE_LABELS[item.notificationType] || humanize(item.notificationType) || 'Thông báo hệ thống';
}

function notificationDestination(item, pathname) {
  const role = pathname.split('/')[1];
  const type = item.notificationType;
  const payload = item.payload || {};
  const sessionId = payload.sessionId || (item.targetType === 'CLASS_SESSION' ? item.targetId : null);

  if (role === 'member') {
    if (sessionId && ['BOOKING_CREATED', 'SESSION_ROOM_CHANGED', 'SESSION_RESCHEDULED'].includes(type)) {
      return `/member/class-sessions?sessionId=${encodeURIComponent(sessionId)}`;
    }
    if (['BOOKING_CANCELLED', 'SESSION_CANCELLED'].includes(type)) {
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
    if (type === 'PAYMENT_PAID') return '/member/receipts';
    if (type?.startsWith('MEMBERSHIP_FREEZE_') || type?.startsWith('MEMBERSHIP_TERMINATION_')) {
      return '/member/membership-requests';
    }
    if (type?.startsWith('MEMBERSHIP_REFUND_')) return '/member/receipts';
    if (['WAITLIST_PROMOTED', 'WAITLIST_CANCELLED'].includes(type)) return '/member/class-sessions';
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
    if (type?.startsWith('MEMBERSHIP_REFUND_')) return '/manager/refunds';
    if (type?.startsWith('MEMBERSHIP_FREEZE_') || type?.startsWith('MEMBERSHIP_TERMINATION_')) {
      return '/manager/membership-requests';
    }
    if (type?.startsWith('COACH_LEAVE_')) return '/manager/coach-leave-requests';
    return '/manager/dashboard';
  }
  return null;
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mutating, setMutating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listNotifications({ unreadOnly, page, size: 20 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  async function handleRead(item) {
    setMutating(item.id);
    setError(null);
    try {
      await markNotificationRead(item.id);
      window.dispatchEvent(new Event('scms:notifications-changed'));
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setMutating(null);
    }
  }

  async function handleOpen(item) {
    const destination = notificationDestination(item, pathname);
    if (!destination || mutating != null) return;

    if (!item.read) {
      setMutating(item.id);
      setError(null);
      try {
        await markNotificationRead(item.id);
        window.dispatchEvent(new Event('scms:notifications-changed'));
      } catch (err) {
        setError(err);
        setMutating(null);
        return;
      }
      setMutating(null);
    }

    navigate(destination);
  }

  function handleCardKeyDown(event, item) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpen(item);
    }
  }

  async function handleReadAll() {
    setMutating('all');
    setError(null);
    try {
      await markAllNotificationsRead();
      window.dispatchEvent(new Event('scms:notifications-changed'));
      setPage(0);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setMutating(null);
    }
  }

  const rows = result?.content || [];

  return (
    <div>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Thông báo</h1>
          <p className="text-muted mb-0">
            {result ? `${result.unreadCount} thông báo chưa đọc` : 'Theo dõi các thay đổi liên quan đến tài khoản.'}
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Form.Check type="switch" id="notification-unread-only" label="Chỉ chưa đọc" checked={unreadOnly}
            onChange={(event) => { setPage(0); setUnreadOnly(event.target.checked); }} />
          <Button variant="outline-danger" size="sm" disabled={mutating != null || !result?.unreadCount} onClick={handleReadAll}>
            {mutating === 'all' ? 'Đang xử lý…' : 'Đánh dấu tất cả đã đọc'}
          </Button>
        </div>
      </div>

      <ErrorAlert error={error} title="Không xử lý được thông báo" onClose={() => setError(null)} />

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : rows.length === 0 ? (
        <Alert variant="light" className="border">{unreadOnly ? 'Không còn thông báo chưa đọc.' : 'Bạn chưa có thông báo nào.'}</Alert>
      ) : (
        <div className="d-grid gap-3">
          {rows.map((item) => (
            <Card
              key={item.id}
              className={`shadow-sm${item.read ? ' border-0' : ' border-danger border-start border-4'}`}
              role="link"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => handleOpen(item)}
              onKeyDown={(event) => handleCardKeyDown(event, item)}
              aria-label={`${notificationSummary(item)}. Xem chi tiết`}
            >
              <Card.Body className="d-flex gap-3 align-items-start">
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                    <strong>{notificationSummary(item)}</strong>
                    {!item.read ? <Badge bg="danger">Mới</Badge> : null}
                  </div>
                  <div className="text-muted small">
                    {formatGymDate(item.createdAt)} · {formatGymTime(item.createdAt)}
                    {item.targetType ? ` · ${TARGET_LABELS[item.targetType] || humanize(item.targetType)}` : ''}
                  </div>
                </div>
                {!item.read ? (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={mutating != null}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRead(item);
                    }}
                  >
                    {mutating === item.id ? 'Đang lưu…' : 'Đã đọc'}
                  </Button>
                ) : null}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {result && result.totalPages > 1 ? (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <Button variant="outline-secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
          <span className="text-muted small">Trang {page + 1}/{result.totalPages}</span>
          <Button variant="outline-secondary" size="sm" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
        </div>
      ) : null}
    </div>
  );
}
