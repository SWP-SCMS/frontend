export const PLAN_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
];

export const PLAN_STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

export const BENEFIT_LABELS = {
  CENTER_ACCESS: 'Sử dụng khu tự tập luyện',
  CLASS_BOOKING: 'Đặt lịch lớp',
  POOL_ACCESS: 'Sử dụng hồ bơi',
  MASSAGE_ACCESS: 'Dịch vụ massage',
  OUTDOOR_SPORT_ACCESS: 'Khu thể thao ngoài trời',
  PERSONAL_COACHING: 'Huấn luyện viên cá nhân',
  TRAINING_PLAN: 'Giáo án tập luyện',
  TRAINING_FEEDBACK: 'Nhận xét huấn luyện',
  TRAINING_RESULT: 'Kết quả tập luyện',
};

export function benefitLabel(benefit) {
  return (
    benefit?.displayName ||
    BENEFIT_LABELS[benefit?.code] ||
    benefit?.code ||
    '—'
  );
}

export function planErrorCode(error) {
  return error?.response?.data?.code || '';
}

export function planErrorMessage(error) {
  switch (planErrorCode(error)) {
    case 'MEMBERSHIP_PLAN_CODE_CONFLICT':
      return 'Mã loại gói này đã tồn tại.';
    case 'MEMBERSHIP_PLAN_BENEFITS_LOCKED':
      return 'Không thể đổi quyền lợi vì loại gói này đã được sử dụng trong đơn hàng.';
    case 'MEMBERSHIP_PLAN_NOT_FOUND':
      return 'Không tìm thấy loại gói tập.';
    case 'MEMBERSHIP_PLAN_VALIDATION_ERROR':
      return 'Thông tin loại gói chưa hợp lệ. Vui lòng kiểm tra lại.';
    default:
      return '';
  }
}
