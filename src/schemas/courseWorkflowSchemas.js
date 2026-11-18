import { z } from 'zod';

const required = (maximum) => z.string().trim().min(1, 'Vui lòng nhập thông tin.').max(maximum, `Không quá ${maximum} ký tự.`);
export const courseDecisionSchema = z.object({ reason: required(1000) });
export const courseVerificationSchema = courseDecisionSchema.extend({
  amountVnd: z.string().trim().regex(/^\d{1,19}$/, 'Nhập số tiền VND nguyên, không âm, tối đa 19 chữ số.'),
  disbursementReference: required(200),
  evidenceReference: required(500),
});

export const courseDisbursementSchema = z.object({
  method: z.enum(['CASH', 'BANK_TRANSFER']),
  reference: required(200),
  evidenceReference: required(500),
  confirmed: z.boolean().refine(Boolean, 'Vui lòng xác nhận đã chi đúng khoản tiền.'),
});
