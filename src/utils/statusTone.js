export function statusTone(label, fallback = 'neutral') {
  const text = String(label || '').trim().toLowerCase();
  if (text === 'đã duyệt, chưa ghi nhận chi') return 'blue';
  if (/chưa|chờ|pending/.test(text)) return /xác minh/.test(text) ? 'purple' : 'amber';
  if (/từ chối|thất bại|lỗi|tạm khóa|suspended|failed|rejected/.test(text)) return 'red';
  if (/trả lại/.test(text)) return 'orange';
  if (/đã hủy|đã rút|hết hạn|ngừng|ngưng|không còn|lưu trữ|bản nháp|chấm dứt|cancelled|inactive|expired/.test(text)) return 'neutral';
  if (/đang diễn ra|đang đóng băng|đang xử lý/.test(text)) return 'purple';
  if (/mở đăng ký|sắp|lên lịch|đề nghị|chờ kích hoạt/.test(text)) return 'blue';
  if (/hoàn tất|hoàn thành|kết thúc|đã duyệt|xác nhận|công bố|hoạt động|đã chuyển|đã thanh toán|đã thu|active|completed|published/.test(text)) return 'green';
  return fallback;
}
export const variantTone = { success: 'green', danger: 'red', warning: 'amber', primary: 'blue', info: 'blue', secondary: 'neutral', light: 'neutral', dark: 'neutral' };
