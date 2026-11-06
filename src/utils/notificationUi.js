const TYPE_LABELS = {
  COURSE_TRANSFER_REQUESTED: 'Có yêu cầu chuyển đợt học cần duyệt',
  COURSE_TRANSFER_OFFERED: 'Bạn có đề nghị chuyển đợt học cần chấp nhận',
  COURSE_TRANSFER_REJECTED: 'Yêu cầu chuyển đợt học đã bị từ chối',
  COURSE_TRANSFER_COMPLETED: 'Đã hoàn tất chuyển đợt học',
  COURSE_TRANSFER_EXPIRED: 'Đề nghị chuyển đợt học đã hết hạn',
  COURSE_PAYMENT_PAID: 'Đã ghi nhận thanh toán khóa học',
  COURSE_RUN_SETTLEMENT_PENDING: 'Đợt học đang chờ quyết toán',
  COURSE_REFUND_DISBURSED: 'Đã ghi nhận chi tiền hoàn khóa học, chờ xác minh',
  COURSE_REFUND_VERIFICATION_READY: 'Có khoản hoàn khóa học chờ xác minh',
  COURSE_REFUND_COMPLETED: 'Khoản hoàn khóa học đã được xác minh hoàn tất',
  COURSE_REFUND_FAILED: 'Xử lý khoản hoàn khóa học thất bại',
  COURSE_REFUND_RETURNED: 'Khoản chi hoàn khóa học đã được trả lại',

  COURSE_WITHDRAWAL_CANCELLED: 'Yêu cầu rút đã hủy; quyền học được khôi phục theo trạng thái khóa',
  COURSE_RUN_COMPLETED: 'Đợt học đã hoàn thành; khoản hoàn được xử lý riêng',
  COURSE_WITHDRAWAL_REQUESTED: 'Đã tạo yêu cầu rút khóa học của bạn',
  COURSE_WITHDRAWAL_REVIEW_REQUIRED: 'Có yêu cầu rút khóa học cần duyệt',
  COURSE_WITHDRAWAL_APPROVED: 'Yêu cầu rút khóa học đã được duyệt',
  COURSE_WITHDRAWAL_REJECTED: 'Yêu cầu rút khóa học đã bị từ chối',
  COURSE_REFUND_APPROVED: 'Nghĩa vụ hoàn tiền khóa học đã được duyệt, chưa xác nhận chi tiền',
  COURSE_REFUND_REJECTED: 'Nghĩa vụ hoàn tiền khóa học đã bị từ chối',

  COURSE_WAITLIST_INVITED: 'Đã có chỗ trống cho khóa học bạn đang chờ',
  COURSE_WAITLIST_CANCELLED: 'Danh sách chờ khóa học đã bị hủy',
  COURSE_SCHEDULE_CHANGED: 'Lịch khóa học đã thay đổi',
  COURSE_SESSION_CANCELLED: 'Buổi học khóa đã hủy, chờ xếp bù',
  COURSE_SESSION_MAKEUP_SCHEDULED: 'Đã xếp buổi học bù cho khóa học',
  COURSE_RUN_CONFIRMED: 'Đợt khóa học đã được xác nhận mở',
  COURSE_RUN_CANCELLED: 'Đợt khóa học đã bị hủy',

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
  PAYMENT_FAILED: 'Giao dịch không hợp lệ; đơn thanh toán đã đóng. Liên hệ lễ tân nếu bạn đã chuyển tiền.',
  PAYMENT_PAID: 'Thanh toán thành công',
  ACCOUNT_CREATED: 'Tài khoản đã được tạo',
  ACCOUNT_ACTIVATED: 'Tài khoản đã được kích hoạt',
  ACCOUNT_ACTIVATED_MANUALLY: 'Tài khoản đã được kích hoạt tại quầy',
  MANUAL_ACTIVATION_REVIEW_REQUIRED: 'Có yêu cầu kích hoạt tài khoản cần duyệt',
  ACCOUNT_EMAIL_CHANGE_REQUESTED: 'Đã gửi yêu cầu đổi email tài khoản',
  ACCOUNT_EMAIL_CHANGE_COMPLETED: 'Đổi email tài khoản thành công',
  PASSWORD_RESET_COMPLETED: 'Đặt lại mật khẩu thành công',
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
  MEMBERSHIP_FREEZE_REJECTED: 'Yêu cầu đóng băng bị từ chối',
  MEMBERSHIP_FREEZE_WITHDRAWN: 'Yêu cầu đóng băng đã được rút',
  MEMBERSHIP_TERMINATION_REVIEW_REQUIRED: 'Có yêu cầu hủy gói cần duyệt',
  MEMBERSHIP_TERMINATION_REQUESTED: 'Đã tạo yêu cầu hủy gói',
  MEMBERSHIP_TERMINATION_APPROVED: 'Yêu cầu hủy gói đã được duyệt',
  MEMBERSHIP_TERMINATION_REJECTED: 'Yêu cầu hủy gói bị từ chối',
  MEMBERSHIP_TERMINATION_WITHDRAWN: 'Yêu cầu hủy gói đã được rút',
  MEMBERSHIP_TERMINATION_EXECUTED: 'Gói tập đã được hủy',
  MEMBERSHIP_TERMINATION_OBSOLETE: 'Yêu cầu hủy gói không còn hiệu lực',
  COACH_LEAVE_REQUESTED: 'Có yêu cầu nghỉ của huấn luyện viên',
  COACH_LEAVE_WITHDRAWN: 'Huấn luyện viên đã rút yêu cầu nghỉ',
  COACH_LEAVE_APPROVED: 'Yêu cầu nghỉ đã được duyệt',
  COACH_LEAVE_REJECTED: 'Yêu cầu nghỉ bị từ chối',
  COACH_LEAVE_CANCELLED: 'Huấn luyện viên đã hủy lịch nghỉ',
  WAITLIST_PROMOTED: 'Bạn đã được chuyển từ hàng chờ sang lịch đặt',
  WAITLIST_CANCELLED: 'Hàng chờ của buổi tập đã bị hủy',
  WAITLIST_SKIPPED: 'Bạn đã được bỏ qua khi xét hàng chờ',
  WAITLIST_EXPIRED: 'Hàng chờ của buổi tập đã hết hạn',
  PT_BOOKING_CANCELLED: 'Lịch PT đã bị hủy do thay đổi phân công huấn luyện viên',
  PT_WAITLIST_CANCELLED: 'Hàng chờ PT đã bị hủy do thay đổi phân công huấn luyện viên',
  MEMBERSHIP_REFUND_REQUESTED: 'Đã tạo yêu cầu hoàn tiền',
  MEMBERSHIP_REFUND_FIRST_APPROVED: 'Yêu cầu hoàn tiền đã được duyệt bước đầu',
  MEMBERSHIP_REFUND_CASH_DISBURSED: 'Đã ghi nhận giao tiền hoàn',
  MEMBERSHIP_REFUND_COMPLETED: 'Yêu cầu hoàn tiền đã hoàn tất',
  MEMBERSHIP_REFUND_REJECTED: 'Yêu cầu hoàn tiền bị từ chối',
};

const REASON_LABELS = {
  MEMBER_NOT_ACTIVE: 'Tài khoản hội viên không còn hoạt động',
  MEMBERSHIP_FROZEN: 'Gói tập đang được đóng băng',
  SESSION_NOT_BOOKABLE: 'Buổi tập không còn nhận đặt lịch',
  MEMBERSHIP_BENEFIT_REQUIRED: 'Gói tập không còn đủ quyền lợi yêu cầu',
  BOOKING_DUPLICATE: 'Bạn đã có lịch đặt cho buổi tập này',
  BOOKING_TIME_CONFLICT: 'Bạn đã có lịch tập khác trùng giờ',
  PT_COACH_ASSIGNMENT_MISMATCH: 'Phân công huấn luyện viên PT đã thay đổi',
  BOOKING_CONFLICT: 'Chỗ trống đã được người khác đặt trước',
  SESSION_STARTED: 'Buổi tập đã bắt đầu',
  COACH_ASSIGNMENT_CHANGED: 'Phân công huấn luyện viên đã thay đổi',
};

export function humanize(value) {
  if (!value) return '';
  const text = String(value).replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
}

export function notificationSummary(item) {
  const payload = item?.payload || {};
  if (item?.notificationType?.startsWith('COURSE_')) return TYPE_LABELS[item.notificationType] || 'Có cập nhật về khóa học';
  return payload.message || TYPE_LABELS[item?.notificationType] ||
    humanize(item?.notificationType) || 'Thông báo hệ thống';
}

export function reasonLabel(reasonCode) {
  return REASON_LABELS[reasonCode] || humanize(reasonCode);
}

export function notificationDetail(item) {
  const reasonCode = item?.payload?.reasonCode;
  return reasonCode ? `Lý do: ${reasonLabel(reasonCode)}` : '';
}
