import { z } from 'zod';
import { normalizePhone } from '../utils';

const required = (max = 200) => z.string().trim().min(1, 'Vui lòng nhập thông tin.').max(max, `Không quá ${max} ký tự.`);
const positive = z.coerce.number().int('Vui lòng nhập số nguyên.').min(1, 'Giá trị phải lớn hơn 0.').max(Number.MAX_SAFE_INTEGER, 'Giá trị vượt giới hạn hỗ trợ.');
const dateTime = required().refine((v) => Number.isFinite(Date.parse(`${v}:00+07:00`)), 'Thời gian không hợp lệ.');
const optionalUrl = z.string().trim().max(500, 'Không quá 500 ký tự.').refine((v) => !v || /^https?:\/\//i.test(v) && URL.canParse(v), 'Nhập URL http hoặc https hợp lệ.');
export const courseEditSchema = z.object({ name: required(), description: z.string().trim().max(2000, 'Không quá 2000 ký tự.'), imageUrl: optionalUrl, defaultMinimumEnrollment: positive });
export const courseCreateSchema = courseEditSchema.extend({ code: required(50), disciplineId: required() });
export const courseRunSchema = z.object({
  runCode: required(50), courseId: required(), primaryCoachId: required(), tuitionVnd: positive,
  capacity: positive, minimumEnrollment: positive, totalUnits: positive, namedCoachCommitment: z.boolean(),
  registrationOpensAt: dateTime, registrationClosesAt: dateTime, plannedStartAt: dateTime, plannedEndAt: dateTime,
}).superRefine((v, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (v.minimumEnrollment > v.capacity) issue('minimumEnrollment', 'Số tối thiểu không được vượt sức chứa.');
  if (Date.parse(v.registrationOpensAt) >= Date.parse(v.registrationClosesAt)) issue('registrationClosesAt', 'Đóng đăng ký phải sau thời gian mở.');
  if (Date.parse(v.registrationClosesAt) > Date.parse(v.plannedStartAt)) issue('plannedStartAt', 'Khai giảng không được trước khi đóng đăng ký.');
  if (Date.parse(v.plannedStartAt) >= Date.parse(v.plannedEndAt)) issue('plannedEndAt', 'Kết thúc phải sau khai giảng.');
});
export const minimumEnrollmentSchema = (capacity) => z.object({ minimumEnrollment: positive.max(capacity || Number.MAX_SAFE_INTEGER, 'Không được vượt sức chứa.') });
export const courseOpenSchema = z.object({ policyVersion: required(100) });
export const courseSessionSchema = (editing, totalUnits) => z.object({
  roomId: required(), coachId: required(), startAt: dateTime, endAt: dateTime,
  ...(editing ? {} : { unitNumber: positive.max(totalUnits || Number.MAX_SAFE_INTEGER, 'Vượt số buổi của khóa.'), allocationVnd: positive }),
}).refine((v) => Date.parse(v.startAt) < Date.parse(v.endAt), { path: ['endAt'], message: 'Kết thúc phải sau bắt đầu.' });
export const courseMemberSearchSchema = z.object({ kind: z.enum(['memberId', 'phone']), query: required() }).superRefine((v, ctx) => {
  if (v.kind === 'phone' && !normalizePhone(v.query)) ctx.addIssue({ code: 'custom', path: ['query'], message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.' });
  if (v.kind === 'memberId' && !/^MB-[0-9]+$/.test(v.query)) ctx.addIssue({ code: 'custom', path: ['query'], message: 'Mã hội viên có dạng MB-… (chỉ chữ số sau dấu gạch).'});
});
