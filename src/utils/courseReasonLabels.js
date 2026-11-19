// Exact system messages only: preserve free-form reasons, including English notes.
const SYSTEM_REASONS = {
  'Withdrawal requested after a material schedule change': 'Yêu cầu rút khóa học do trung tâm thay đổi đáng kể lịch học',
  'Member withdrawal refund': 'Hoàn tiền do hội viên rút khóa học',
  'Course Run cancellation refund': 'Hoàn tiền do hủy đợt học',
  'Unresolved Course sessions refund': 'Hoàn tiền cho các buổi học chưa được xử lý',
  'Unused Course transfer credit refund': 'Hoàn phần tiền chuyển khóa học chưa sử dụng',
  'Material Course change refund': 'Hoàn tiền do thay đổi đáng kể khóa học',
  'Course payment exception refund': 'Hoàn tiền do ngoại lệ thanh toán khóa học',
  'Course refund obligation': 'Khoản hoàn tiền khóa học',
  LEGACY_SNAPSHOT_MISSING: 'Thiếu thông tin khoản hoàn',
  COURSE_RUN_CANCELLED: 'Đợt học đã hủy',
  REDUCED_SESSION_COUNT: 'Số buổi đã giảm và có khoản hoàn riêng. Vui lòng gửi lại yêu cầu rút theo lịch mới.',
};

export function courseReasonLabel(reason) {
  return Object.hasOwn(SYSTEM_REASONS, reason) ? SYSTEM_REASONS[reason] : reason;
}
