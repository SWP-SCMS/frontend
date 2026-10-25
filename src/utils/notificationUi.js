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

function humanize(value) {
  if (!value) return '';
  const text = String(value).replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
}

export function notificationSummary(item) {
  const payload = item?.payload || {};
  return payload.message || TYPE_LABELS[item?.notificationType] ||
    humanize(item?.notificationType) || 'Thông báo hệ thống';
}
