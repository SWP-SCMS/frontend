import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RhfDateInput } from '../../../components/common/DateInput';
import { getCourseRunReport } from '../../../services/courseReportingService';
import { COURSE_RUN_STATUS_LABELS, formatCourseMoney, formatCourseDateTime, getCourseErrorMessage, getCourseStatusLabel } from '../../../utils/courseUi';
const date = z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Ngày không hợp lệ.');
const schema = z.object({ startDate: date, endDate: date, status: z.string() }).superRefine((v, ctx) => {
  if (v.startDate && v.endDate) {
    const days = (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000;
    if (days <= 0 || days > 366) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Khoảng ngày phải lớn hơn 0 và không quá 366 ngày.' });
  }
});
const groups = [
  ['Ghi danh', [['activeEnrollments','Đang học'],['withdrawalPendingEnrollments','Chờ rút'],['withdrawnEnrollments','Đã rút'],['transferredEnrollments','Đã chuyển'],['completedEnrollments','Hoàn thành']]],
  ['Điểm danh', [['attendancePresent','Có mặt'],['attendanceAbsent','Vắng'],['attendanceNotRecorded','Chưa ghi nhận']]],
  ['Thanh toán', [['grossAmountVnd','Tổng giá trị',true],['paidAmountVnd','Đã thu',true],['pendingPayments','Số khoản chờ'],['pendingPaymentAmountVnd','Tiền chờ',true],['failedPayments','Số khoản lỗi'],['failedPaymentAmountVnd','Tiền lỗi',true]]],
  ['Hoàn tiền', [['outstandingRefundObligations','Số khoản còn xử lý'],['outstandingRefundAmountVnd','Tiền còn xử lý',true],['completedRefunds','Số khoản hoàn tất'],['completedRefundAmountVnd','Tiền hoàn tất',true]]],
  ['Hàng chờ', [['waitlistWaiting','Đang chờ'],['waitlistInvited','Đã mời'],['waitlistAccepted','Đã nhận']]],
  ['Chuyển đợt', [['transferPending','Chờ duyệt'],['transferOffered','Đã đề nghị'],['transferRejected','Từ chối'],['transferCompleted','Hoàn tất'],['transferExpired','Hết hạn']]],
];
export default function ManagerCourseReportPage() {
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { startDate: '', endDate: '', status: '' } });
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    getCourseRunReport({ ...filters, page }).then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getCourseErrorMessage(err, 'Không tải được báo cáo khóa học.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);
  return <div className="container-fluid py-4"><h1>Báo cáo khóa học</h1>
    <Form noValidate className="d-flex flex-wrap gap-3 mb-3" onSubmit={handleSubmit((values) => { setPage(0); setFilters(Object.fromEntries(Object.entries(values).filter(([,v]) => v))); })}>
      <Form.Group controlId="course-report-start"><Form.Label>Khai giảng từ ngày</Form.Label><RhfDateInput control={control} name="startDate" isInvalid={!!errors.startDate} /><Form.Control.Feedback type="invalid">{errors.startDate?.message}</Form.Control.Feedback></Form.Group>
      <Form.Group controlId="course-report-end"><Form.Label>Đến trước ngày</Form.Label><RhfDateInput control={control} name="endDate" isInvalid={!!errors.endDate} /><Form.Control.Feedback type="invalid">{errors.endDate?.message}</Form.Control.Feedback></Form.Group>
      <Form.Group controlId="course-report-status"><Form.Label>Trạng thái</Form.Label><Form.Select {...register('status')}><option value="">Tất cả</option>{Object.entries(COURSE_RUN_STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Form.Select></Form.Group>
      <Button type="submit" disabled={loading}>Áp dụng / tải lại</Button><Button variant="outline-secondary" disabled={loading} onClick={() => { reset(); setPage(0); setFilters({}); }}>Xóa bộ lọc</Button>
    </Form>
    <p>Ngày theo giờ Việt Nam; không bao gồm ngày kết thúc bộ lọc. Số liệu hiển thị theo từng đợt học.</p>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải báo cáo…</p> : data && <>
      <p>{data.totalElements} đợt học phù hợp</p>
      {!data.content?.length && <p>Không có dữ liệu phù hợp.</p>}
      {data.content?.map((run) => <Card key={run.runId} className="mb-3"><Card.Body>
        <h2 className="h5"><Link to={`/manager/course-runs/${run.runId}`}>{run.courseName} · {run.runCode}</Link></h2>
        <p>{getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, run.status)} · {formatCourseDateTime(run.plannedStartAt)} – {formatCourseDateTime(run.plannedEndAt)}</p>
        <p>Học phí: {formatCourseMoney(run.tuitionVnd)}</p>
        <Table responsive bordered><tbody>{groups.map(([title, fields]) => <tr key={title}><th>{title}</th><td><div className="d-flex flex-wrap gap-3">{fields.map(([field, label, currency]) => <span key={field}>{label}: <strong>{run[field] == null ? '—' : currency ? formatCourseMoney(run[field]) : run[field]}</strong></span>)}</div></td></tr>)}</tbody></Table>
      </Card.Body></Card>)}
    </>}
    <div className="d-flex gap-2"><Button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {page + 1}</span><Button disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
  </div>;
}
