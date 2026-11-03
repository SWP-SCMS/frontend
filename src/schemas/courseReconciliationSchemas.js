import { z } from 'zod';
const text = (max) => z.string().trim().min(1, 'Vui lòng nhập thông tin.').max(max, `Không quá ${max} ký tự.`);
export const courseReconciliationSearchSchema = z.object({ query: z.string().trim().max(200, 'Không quá 200 ký tự.') });
export const courseReconciliationSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('PAID'), evidence: text(4000), reason: text(2000),
    receivedAmount: z.string().trim().regex(/^[0-9]+$/, 'Nhập số tiền nguyên dương bằng VND.')
      .refine(value => /^[0-9]+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0, 'Số tiền không hợp lệ hoặc vượt giới hạn hỗ trợ.')
      .transform(Number),
    transferContent: text(200), providerTransactionId: text(100),
  }),
  z.object({ status: z.literal('FAILED'), evidence: text(4000), reason: text(2000) }),
]);
