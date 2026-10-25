export const ACTIVATION_STATUS_LABELS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

export const ACTIVATION_REASON_LABELS = {
  EMAIL_DELIVERY_FAILED: 'Không nhận được email',
  MEMBER_CANNOT_ACCESS_EMAIL: 'Không truy cập được email',
  ACCESSIBILITY_SUPPORT: 'Cần hỗ trợ tiếp cận',
  OTHER: 'Lý do khác',
};

export const VERIFICATION_METHOD_LABELS = {
  IN_PERSON_GOVERNMENT_ID_CHECK: 'Đối chiếu giấy tờ tùy thân',
  IN_PERSON_PROFILE_AND_REGISTERED_PHONE_MATCH:
    'Đối chiếu hồ sơ và số điện thoại đăng ký',
  OTHER_APPROVED_PROCEDURE: 'Quy trình xác minh khác đã được duyệt',
};

export function activationStatusLabel(status) {
  return ACTIVATION_STATUS_LABELS[status] || 'Không xác định';
}

export function activationReasonLabel(reason) {
  return ACTIVATION_REASON_LABELS[reason] || 'Lý do khác';
}

export function verificationMethodLabel(method) {
  return VERIFICATION_METHOD_LABELS[method] || 'Phương thức khác';
}
