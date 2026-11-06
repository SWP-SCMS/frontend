import { z } from 'zod';
const required = z.string().trim().min(1, 'Vui lòng nhập thông tin.');
const positive = z.coerce.number().int('Vui lòng nhập số nguyên.').min(1, 'Giá trị phải lớn hơn 0.').max(Number.MAX_SAFE_INTEGER, 'Giá trị quá lớn.');
const date = required.refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Ngày không hợp lệ.');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ.');
export const weeklyScheduleSchema = z.object({
  openingDate: date, weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'Chọn ít nhất một thứ học.'),
  startTime: time, endTime: time, totalUnits: positive.max(366, 'Không quá 366 buổi.'),
}).superRefine((v, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code:'custom', path:[path], message });
  if (v.endTime <= v.startTime) issue('endTime', 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.');
  const day = new Date(v.openingDate + 'T00:00:00Z').getUTCDay() || 7;
  if (!v.weekdays.includes(day)) issue('openingDate', 'Ngày khai giảng phải thuộc một trong các thứ học đã chọn.');
});
const timestamp = required.refine(v => {
  const parts = v.split('T');
  return parts.length === 2 && date.safeParse(parts[0]).success && time.safeParse(parts[1]).success;
}, 'Ngày giờ không hợp lệ.');
export const weeklyCourseRunSchema = z.object({
  runCode: required.max(50, 'Không quá 50 ký tự.'), courseId: required, primaryCoachId: required, roomId: required,
  tuitionVnd: positive, capacity: positive, minimumEnrollment: positive, namedCoachCommitment: z.boolean(),
  registrationOpensAt: timestamp, registrationClosesAt: timestamp, schedule: weeklyScheduleSchema,
}).superRefine((v, ctx) => {
  const issue = (path, message) => ctx.addIssue({code:'custom',path,message});
  if (v.minimumEnrollment > v.capacity) issue(['minimumEnrollment'], 'Số tối thiểu không được vượt sức chứa.');
  if (v.tuitionVnd < v.schedule.totalUnits) issue(['tuitionVnd'], 'Học phí phải đủ phân bổ ít nhất 1 VND cho mỗi buổi.');
  if (v.registrationOpensAt >= v.registrationClosesAt) issue(['registrationClosesAt'], 'Đóng đăng ký phải sau thời gian mở.');
  if (v.registrationClosesAt > `${v.schedule.openingDate}T${v.schedule.startTime}`) issue(['registrationClosesAt'], 'Đóng đăng ký không được sau giờ khai giảng.');
  if (Date.parse(`${v.schedule.openingDate}T${v.schedule.startTime}:00+07:00`) <= Date.now()) issue(['schedule','openingDate'], 'Ngày giờ khai giảng phải ở tương lai.');
});
export const weeklyRunPayload = values => ({ ...values,
  registrationOpensAt: new Date(values.registrationOpensAt + ':00+07:00').toISOString(),
  registrationClosesAt: new Date(values.registrationClosesAt + ':00+07:00').toISOString(),
});
