import { z } from 'zod';

export const membershipPlanSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã loại gói.')
    .regex(
      /^[A-Z][A-Z0-9_]{1,49}$/,
      'Mã phải có 2–50 ký tự, bắt đầu bằng chữ cái và chỉ gồm A–Z, 0–9, dấu gạch dưới.',
    ),
  displayName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên hiển thị.')
    .max(100, 'Tên hiển thị không được vượt quá 100 ký tự.'),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Vui lòng chọn trạng thái.',
  }),
  benefitCodes: z
    .array(z.string())
    .min(1, 'Chọn ít nhất một quyền lợi.'),
});
