import StaffPagination from '../../../components/common/StaffPagination';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { RhfDateInput } from '../../../components/common/DateInput';
import { getCourseRunReport } from '../../../services/courseReportingService';
import { COURSE_RUN_STATUS_LABELS, formatCourseMoney, formatCourseDateTime, getCourseErrorMessage, getCourseStatusLabel } from '../../../utils/courseUi';
import './ManagerCourseReportPage.css';
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
];
export default function ManagerCourseReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { startDate: '', endDate: '', status: '' } });
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let active = true;
    if (!background) commitValue(setLoading, true); commitError(setError, ''); if (!background) commitValue(setData, null);
    track(getCourseRunReport({ ...filters, ...(runId ? { runId } : {}), page }).then((result) => { if (active) commitValue(setData, result); })
      .catch((err) => { failed(err);  if (active) commitError(setError, getCourseErrorMessage(err, 'Không tải được báo cáo khóa học.')); })
      .finally(() => { if (active) if (!background) commitValue(setLoading, false); }));
    return () => { active = false; };
  }, [filters, page, runId]);
  return <div className="scms-course-workspace"><h1>Báo cáo khóa học</h1>
    {runId && <Alert variant="info">Đang xem riêng đợt học đã chọn. <Link to={'/manager/course-runs/' + encodeURIComponent(runId)}>Xem chi tiết đợt học</Link>. <Button size="sm" variant="outline-secondary" onClick={() => { setSearchParams({}); setPage(0); }}>Xem tất cả đợt học</Button></Alert>}
    <Form noValidate className="course-report-filters mb-3" onSubmit={handleSubmit((values) => { setPage(0); setFilters(Object.fromEntries(Object.entries(values).filter(([,v]) => v))); })}>
      <Form.Group controlId="course-report-start"><Form.Label>Khai giảng từ ngày</Form.Label><RhfDateInput control={control} name="startDate" isInvalid={!!errors.startDate} /><Form.Control.Feedback type="invalid">{errors.startDate?.message}</Form.Control.Feedback></Form.Group>
      <Form.Group controlId="course-report-end"><Form.Label>Đến trước ngày</Form.Label><RhfDateInput control={control} name="endDate" isInvalid={!!errors.endDate} /><Form.Control.Feedback type="invalid">{errors.endDate?.message}</Form.Control.Feedback></Form.Group>
      <Form.Group controlId="course-report-status"><Form.Label>Trạng thái</Form.Label><Form.Select {...register('status')}><option value="">Tất cả</option>{Object.entries(COURSE_RUN_STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Form.Select></Form.Group>
      <div className="course-report-filter-actions"><Button type="submit" disabled={loading}>Áp dụng / tải lại</Button><Button variant="outline-secondary" disabled={loading} onClick={() => { reset(); setPage(0); setFilters({}); }}>Xóa bộ lọc</Button></div>
    </Form>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải báo cáo…</p> : data && <>
      <p>{data.totalElements} đợt học phù hợp</p>
      {!data.content?.length && <p>Không có dữ liệu phù hợp.</p>}
      {data.content?.map((run) => <Card key={run.runId} className="mb-3"><Card.Body>
        <h2 className="h5"><Link to={`/manager/course-runs/${run.runId}`}>{run.courseName} · {run.runCode}</Link></h2>
        <p>{getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, run.status)} · {formatCourseDateTime(run.plannedStartAt)} – {formatCourseDateTime(run.plannedEndAt)}</p>
        <p>Học phí: {formatCourseMoney(run.tuitionVnd)}</p>
        <div className="course-report-groups">{groups.map(([title, fields]) => <section className="course-report-group" key={title}>
          <h3 className="h6 fw-bold mb-3">{title}</h3>
          <dl className="course-report-metrics">{fields.map(([field, label, currency]) => <div key={field}>
            <dt>{label}</dt><dd>{run[field] == null ? '—' : currency ? formatCourseMoney(run[field]) : run[field]}</dd>
          </div>)}</dl>
        </section>)}</div>
      </Card.Body></Card>)}
    </>}
    <StaffPagination page={page} totalPages={data?.totalPages} totalElements={data?.totalElements} loading={loading || !data} onPageChange={setPage} />
  </div>;
}
