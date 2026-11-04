import { extractErrorMessage } from './errorMessages.js';

const LABELS = {
  fullName: 'Họ và tên', phone: 'Số điện thoại', email: 'Email', birthDate: 'Ngày sinh',
  profileImageUrl: 'Ảnh đại diện', fitnessGoal: 'Mục tiêu rèn luyện',
  emergencyContactName: 'Họ tên người liên hệ', emergencyContactPhone: 'Số điện thoại khẩn cấp',
  gender: 'Giới tính', address: 'Địa chỉ', physicalConditionNotes: 'Ghi chú thể chất và chấn thương',
  emergencyContactRelationship: 'Mối quan hệ', emergencyContactTimeNotes: 'Ghi chú khung giờ liên hệ',
};

function fieldMessage(field, raw) {
  const label = LABELS[field] || 'Thông tin';
  if (field === 'emergencyContact') return 'Liên hệ khẩn cấp phải nhập cả họ tên và số điện thoại, hoặc để trống cả hai.';
  if (field === 'gender') return 'Vui lòng chọn Nam hoặc Nữ, hoặc để trống giới tính.';
  const limit = typeof raw === 'string' && /^must not exceed (\d+) characters$/.exec(raw);
  if (limit) return `${label} không được vượt quá ${limit[1]} ký tự.`;
  switch (raw) {
    case 'must not be null':
    case 'must not be blank': return `${label} không được để trống.`;
    case 'must be null or non-blank': return `${label} không được chỉ chứa khoảng trắng. Hãy nhập nội dung hoặc xóa để bỏ trống.`;
    case 'must contain letters and valid name separators only': return `${label} chỉ được chứa chữ cái và dấu phân cách tên hợp lệ.`;
    case 'must be 10 digits starting with 0': return `${label} phải có 10 chữ số và bắt đầu bằng 0.`;
    case 'must be a well-formed email address': return 'Địa chỉ email không hợp lệ.';
    case 'must not be in the future': return 'Ngày sinh không được ở tương lai.';
    default: return `${label} chưa hợp lệ. Vui lòng kiểm tra lại.`;
  }
}

// Local to member profile: never display raw backend detail or unknown validation text.
export function localizeMemberProfileError(err) {
  const data = err?.response?.data;
  const errors = {};
  if (err?.response?.status === 400 && data?.code === 'VALIDATION_ERROR' && data.errors) {
    for (const [field, values] of Object.entries(data.errors)) {
      const target = field === 'emergencyContact' ? 'emergencyContactPhone' : field;
      const messages = (Array.isArray(values) ? values : [values]).map(value => fieldMessage(field, value));
      errors[target] = [...(errors[target] || []), ...messages];
    }
  }
  const message = Object.keys(errors).length
    ? [...new Set(Object.values(errors).flat())].join(' ')
    : extractErrorMessage(err, 'Không lưu được hồ sơ. Vui lòng thử lại.');
  return {
    message,
    response: err?.response ? { ...err.response, data: { ...data, errors } } : undefined,
  };
}
