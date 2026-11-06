export const COURSE_REFUND_STATUS_LABELS = {
  PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt, chưa ghi nhận chi',
  DISBURSEMENT_RECORDED: 'Đã ghi nhận chi, chờ xác minh', PENDING_VERIFICATION: 'Chờ xác minh',
  COMPLETED: 'Đã xác minh hoàn tất', REJECTED: 'Đã từ chối', FAILED: 'Thất bại', RETURNED: 'Khoản chi đã được trả lại',
};

export const COURSE_REFUND_SOURCE_LABELS = {
  MEMBER_WITHDRAWAL: 'Rút khóa học', COURSE_RUN_CANCELLED: 'Hủy đợt học', MATERIAL_CHANGE: 'Thay đổi đáng kể',
  UNRESOLVED_SESSIONS: 'Buổi học chưa xử lý', REDUCED_SESSION_COUNT: 'Hoàn tiền buổi bị giảm', TRANSFER_CREDIT_EXCESS: 'Chênh lệch chuyển đợt', PAYMENT_EXCEPTION: 'Điều chỉnh thanh toán',
};

export const COURSE_TRANSFER_STATUS_LABELS = {
  PENDING: 'Chờ duyệt', OFFERED: 'Chờ hội viên chấp nhận', PENDING_PAYMENT: 'Chờ thanh toán chênh lệch',
  COMPLETED: 'Đã chuyển đợt học', REJECTED: 'Đã từ chối', EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy',
};

export const COURSE_TRANSFER_REQUEST_STATUS_LABELS = {
  PENDING: 'Chờ duyệt', OFFERED: 'Đã gửi đề nghị', COMPLETED: 'Đã chuyển đợt học',
  REJECTED: 'Đã từ chối', EXPIRED: 'Đã hết hạn',
};

export const COURSE_WITHDRAWAL_STATUS_LABELS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt rút', REJECTED: 'Đã từ chối', CANCELLED: 'Đã hủy' };
export const COURSE_RESPONSE_LABELS = { CONTINUE: 'Tiếp tục học', REQUEST_TRANSFER: 'Đề nghị chuyển đợt học', REQUEST_WITHDRAWAL: 'Yêu cầu rút do đổi lịch' };
export const COURSE_ELIGIBILITY_LABELS = { ELIGIBLE: 'Đủ điều kiện chi', AWAITING_COURSE_COMPLETION: 'Chờ đợt học hoàn thành', COURSE_RUN_NOT_FOUND: 'Không tìm thấy đợt học' };

export function courseRefundActions(status) {
  if (status === 'PENDING_REVIEW') return ['approve', 'reject'];
  if (status === 'APPROVED') return ['fail'];
  if (['DISBURSEMENT_RECORDED', 'PENDING_VERIFICATION'].includes(status)) return ['verify', 'fail', 'return'];
  return [];
}

export function canRespondToCourseChange(change, now = Date.now()) {
  return change.status === 'PENDING' && !change.response && Date.parse(change.responseDeadline) > now;
}

export function canAcceptCourseTransfer(offer, now = Date.now()) {
  return offer.status === 'OFFERED' && !offer.acceptedAt && Date.parse(offer.expiresAt) > now;
}

// Ignore invalid/rounded amounts rather than silently sending a different financial value.
export function courseAmountText(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const text = String(value ?? '');
  return /^\d{1,19}$/.test(text) ? text : null;
}

export function courseMakeupIds(sessions) {
  return new Set(sessions.flatMap((session) => [session.replacementSessionId, session.isMakeup ? session.id : null]).filter(Boolean));
}

export function courseScheduleEntries(enrollments) {
  return enrollments.filter((item) => item.lifecycleStatus === 'ACTIVE' && !item.learningSuspended && item.courseRunStatus !== 'CANCELLED')
    .flatMap((item) => (item.sessions || []).filter((session) => session.disposition === 'ENROLLED' && (!session.sessionStatus || ['SCHEDULED', 'MAKEUP_SCHEDULED', 'COMPLETED'].includes(session.sessionStatus))).map((session) => ({
      ...session,
      id: 'course-' + session.enrollmentSessionId,
      bookingId: 'course-' + session.enrollmentSessionId,
      sessionId: session.courseSessionId,
      classType: 'COURSE',
      className: item.courseName + ' · ' + item.runCode + ' · Buổi ' + session.unitNumber,
      startTime: session.startAt,
      endTime: session.endAt,
    })));
}

export function courseNotificationDestination(item, role) {
  const type = item?.notificationType || '';
  if (!type.startsWith('COURSE_')) return null;
  if (role === 'member') {
    if (type.startsWith('COURSE_REFUND_')) return '/member/courses/refunds';
    if (type.startsWith('COURSE_TRANSFER_')) return '/member/courses/transfers';
    if (type === 'COURSE_SCHEDULE_CHANGED') return '/member/courses/schedule-changes';
    if (type.startsWith('COURSE_WITHDRAWAL_')) return '/member/courses/withdrawals';
    if (type.startsWith('COURSE_WAITLIST_')) return '/member/courses/waitlist';
    return '/member/courses';
  }
  if (role === 'reception' && type.startsWith('COURSE_REFUND_')) return '/reception/course-refunds';
  if (role === 'manager') {
    const pages = [
      ['COURSE_REFUND_', 'refunds', 'COURSE_REFUND_OBLIGATION'],
      ['COURSE_WITHDRAWAL_', 'withdrawals', 'COURSE_WITHDRAWAL_REQUEST'],
      ['COURSE_TRANSFER_', 'transfers', 'COURSE_TRANSFER_REQUEST'],
    ];
    for (const [prefix, page, targetType] of pages) {
      if (type.startsWith(prefix)) return '/manager/course-' + page
        + (item.targetType === targetType && item.targetId ? '?id=' + encodeURIComponent(item.targetId) : '');
    }
    return '/manager/course-runs';
  }
  return null;
}
