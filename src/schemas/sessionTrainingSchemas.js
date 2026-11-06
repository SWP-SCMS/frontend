import { z } from 'zod';

export const sessionTrainingTextSchema = z.object({
  content: z.string().trim().min(1, 'Vui lòng nhập nội dung trước khi lưu.'),
});
