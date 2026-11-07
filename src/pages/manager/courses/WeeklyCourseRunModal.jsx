import SessionSlotSelect from '../../../components/common/SessionSlotSelect';
import useCourseResourceAvailability from '../../../hooks/useCourseResourceAvailability';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { DateInput } from '../../../components/common/DateInput';
import CourseDateTimeInput from '../../../components/common/CourseDateTimeInput';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { weeklyScheduleSchema, weeklyCourseRunSchema, weeklyRunPayload } from '../../../schemas/courseWeeklySchema';
import { createWeeklyCourseRun, previewCourseWeeklySchedule } from '../../../services/courseAdminService';
import { formatCourseDateTime, getCourseErrorMessage } from '../../../utils/courseUi';

const weekdays = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
export default function WeeklyCourseRunModal({ courses, onClose, onCreated }) {
  const form = useForm({ resolver:zodResolver(weeklyCourseRunSchema), mode:'onChange', defaultValues:{
    runCode:'',courseId:'',primaryCoachId:'',roomId:'',tuitionVnd:'',capacity:'',minimumEnrollment:'',
    registrationOpensAt:'',registrationClosesAt:'',namedCoachCommitment:true,
    schedule:{openingDate:'',weekdays:[],startTime:'',endTime:'',totalUnits:''},
  }});
  const { register, control, handleSubmit, setValue, setError, getValues, getFieldState, trigger, formState:{errors} } = form;
  const schedule = useWatch({control,name:'schedule'});
  const capacity = useWatch({control,name:'capacity'});
  const opensAt = useWatch({control,name:'registrationOpensAt'});
  const scheduleKey = JSON.stringify(schedule);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setServerError] = useState('');
  const [retry, setRetry] = useState(0);
  const savingRef = useRef(false);
  const parsed = weeklyScheduleSchema.safeParse(schedule);
  const currentPreview = preview?.key === scheduleKey ? preview.data : null;
  const availability = useCourseResourceAvailability({ windows: currentPreview?.sessions.map(s => ({ startAt: s.startAt, endAt: s.endAt })) || [], capacity });
  const { coaches, rooms } = availability;
  useEffect(() => {
    if (!availability.ready) return;
    const roomId = getValues('roomId');
    setValue('roomId', rooms.some(r => r.id === roomId) ? roomId : '');
    const coachId = getValues('primaryCoachId');
    setValue('primaryCoachId', coaches.some(c => c.accountId === coachId) ? coachId : '');
  }, [availability.ready, rooms, coaches, getValues, setValue]);
  // Recheck existing cross-field errors when their dependencies change.
  useEffect(() => {
    const fields = ['schedule.openingDate', 'schedule.endTime', 'minimumEnrollment', 'tuitionVnd', 'registrationClosesAt', 'roomId'];
    const invalid = fields.filter(name => getFieldState(name).error);
    if (invalid.length) void trigger(invalid);
  }, [scheduleKey, capacity, opensAt, getFieldState, trigger]);
  useEffect(() => {
    const parsed = weeklyScheduleSchema.safeParse(JSON.parse(scheduleKey));
    setPreviewError('');
    if (!parsed.success) { setLoading(false); return; }
    const abort = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await previewCourseWeeklySchedule(parsed.data, abort.signal);
        if (!abort.signal.aborted) setPreview({key:scheduleKey,data});
      } catch (err) {
        if (!abort.signal.aborted) { setPreview(null); setPreviewError(getCourseErrorMessage(err,'Không tải được lịch dự kiến. Vui lòng thử lại.')); }
      } finally { if (!abort.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [scheduleKey, retry]);

  async function save(values) {
    if (savingRef.current || !currentPreview || loading || !availability.ready) return;
    const room = rooms.find(r=>r.id===values.roomId);
    if (!room || room.capacity < values.capacity) {
      setError('roomId',{message:'Chọn phòng đang hoạt động và đủ sức chứa.'}); return;
    }
    if (!coaches.some(c => c.accountId === values.primaryCoachId)) { setError('primaryCoachId', { message: 'Chọn huấn luyện viên còn trống.' }); return; }
    savingRef.current=true; setSaving(true); setServerError('');
    try { const result=await createWeeklyCourseRun(weeklyRunPayload(values)); onCreated(result.run); }
    catch (err) { setServerError(getCourseErrorMessage(err,'Không tạo được đợt học. Vui lòng thử lại.')); }
    finally { savingRef.current=false; setSaving(false); }
  }
  const feedback = name => <Form.Control.Feedback type="invalid" className="d-block">{errors[name]?.message}</Form.Control.Feedback>;
  const scheduleFeedback = name => <div className="invalid-feedback d-block">{errors.schedule?.[name]?.message || (!parsed.success && parsed.error.issues.find(i=>i.path[0]===name)?.message)}</div>;
  const input = (name,label,type='text',props={}) => <><Form.Label htmlFor={`weekly-${name}`}>{label}</Form.Label><Form.Control id={`weekly-${name}`} type={type} {...register(name)} isInvalid={!!errors[name]} {...props}/>{feedback(name)}</>;
  return <Modal show onHide={()=>{if(!saving)onClose();}} size="xl" centered scrollable backdrop={saving?'static':true} keyboard={!saving}>
    <Form noValidate onSubmit={event => void handleSubmit(save)(event)} className="d-flex flex-column overflow-hidden">
      <Modal.Header closeButton={!saving}><Modal.Title>Tạo đợt mở khóa học</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <ErrorAlert error={error} title="Không tạo được đợt học" />}
        <fieldset disabled={saving}><Row className="g-3">
          <Col md={4}>{input('runCode','Mã đợt *','text',{maxLength:50})}</Col>
          <Col md={4}><Form.Label htmlFor="weekly-course">Khóa học *</Form.Label><Form.Select id="weekly-course" {...register('courseId',{onChange:e=>{
            const c=courses.find(c=>c.id===e.target.value); if(c?.defaultMinimumEnrollment)setValue('minimumEnrollment',c.defaultMinimumEnrollment);
          }})} isInvalid={!!errors.courseId}><option value="">-- Chọn khóa học --</option>{courses.filter(c=>c.status==='PUBLISHED').map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</Form.Select>{feedback('courseId')}</Col>
          <Col md={4}>{input('tuitionVnd','Học phí (VND) *','number',{min:1})}</Col>
          <Col md={4}>{input('capacity','Sức chứa *','number',{min:1})}</Col>
          <Col md={4}>{input('minimumEnrollment','Đăng ký tối thiểu *','number',{min:1})}</Col>
          <Col md={4}><Form.Label htmlFor="weekly-units">Tổng số buổi *</Form.Label><Form.Control id="weekly-units" type="number" min={1} max={366} {...register('schedule.totalUnits')}/>{errors.schedule?.totalUnits && scheduleFeedback('totalUnits')}</Col>
          <Col md={6}><Form.Label htmlFor="weekly-opening">Ngày khai giảng dự kiến *</Form.Label><Controller control={control} name="schedule.openingDate" render={({field})=><DateInput {...field} id="weekly-opening" emitInvalid isInvalid={!!errors.schedule?.openingDate}/>}/>{schedule?.openingDate && scheduleFeedback('openingDate')}</Col>
          <Col md={6}><SessionSlotSelect control={control} startName="schedule.startTime" endName="schedule.endTime" id="weekly-slot" /></Col>
          <Col xs={12}><fieldset><legend className="fs-6">Thứ học trong tuần *</legend><Controller control={control} name="schedule.weekdays" render={({field})=><div className="d-flex flex-wrap gap-3">{weekdays.map((day,index)=><Form.Check key={day} id={`weekly-day-${index+1}`} label={day} checked={field.value.includes(index+1)} onBlur={field.onBlur} onChange={e=>field.onChange(e.target.checked?[...field.value,index+1].sort((a,b)=>a-b):field.value.filter(v=>v!==index+1))}/>)}</div>}/>{errors.schedule?.weekdays && scheduleFeedback('weekdays')}</fieldset></Col>
          <Col md={6}><Form.Label htmlFor="registrationOpensAt">Mở đăng ký *</Form.Label><CourseDateTimeInput control={control} name="registrationOpensAt" label="Mở đăng ký"/>{feedback('registrationOpensAt')}</Col>
          <Col md={6}><Form.Label htmlFor="registrationClosesAt">Đóng đăng ký *</Form.Label><CourseDateTimeInput control={control} name="registrationClosesAt" label="Đóng đăng ký"/>{feedback('registrationClosesAt')}</Col>
          <Col md={6}><Form.Label htmlFor="weekly-room">Phòng học *</Form.Label><Form.Select id="weekly-room" disabled={!availability.ready} {...register('roomId')} isInvalid={!!errors.roomId}><option value="">{!availability.ready ? 'Nhập lịch và sức chứa để tìm phòng' : rooms.length ? '-- Chọn phòng --' : 'Không có phòng phù hợp cho toàn bộ lịch'}</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</option>)}</Form.Select>{feedback('roomId')}</Col>
          <Col md={6}><Form.Label htmlFor="weekly-coach">Huấn luyện viên *</Form.Label><Form.Select id="weekly-coach" disabled={!availability.ready} {...register('primaryCoachId')} isInvalid={!!errors.primaryCoachId}><option value="">{!availability.ready ? 'Nhập lịch để tìm HLV' : coaches.length ? '-- Chọn huấn luyện viên --' : 'Không có HLV phù hợp cho toàn bộ lịch'}</option>{coaches.map(c=><option key={c.accountId} value={c.accountId}>{c.fullName||c.email}</option>)}</Form.Select>{feedback('primaryCoachId')}</Col>
          <Col xs={12}>{availability.loading && <span role="status">Đang kiểm tra HLV và phòng…</span>}{availability.error && <><ErrorAlert error={availability.error} title="Không tải được HLV và phòng trống"/><Button type="button" onClick={availability.retry}>Thử lại</Button></>}</Col>
        </Row></fieldset>
        <div className="border rounded p-3 mt-3" aria-live="polite">
          <strong>Lịch học dự kiến</strong>
          {loading && <div role="status" className="mt-2">Đang tính lịch…</div>}
          {previewError && <div className="mt-2"><ErrorAlert error={previewError}/><Button type="button" size="sm" variant="outline-secondary" onClick={()=>setRetry(v=>v+1)}>Thử tải lại lịch</Button></div>}
          {!currentPreview && !loading && !previewError && <p className="text-muted mb-0 mt-2">Chọn ngày khai giảng, thứ học, giờ học và tổng số buổi để xem lịch.</p>}
          {currentPreview && !loading && <><p className="mt-2">Dự kiến kết thúc: <strong>{formatCourseDateTime(currentPreview.plannedEndAt)}</strong> · {currentPreview.sessions.length} buổi</p>
            <div style={{maxHeight:240,overflow:'auto'}}><Table size="sm" className="mb-0"><thead className="table-light"><tr><th>Buổi</th><th>Bắt đầu</th><th>Kết thúc</th></tr></thead><tbody>{currentPreview.sessions.map(s=><tr key={s.unitNumber}><td>{s.unitNumber}</td><td>{formatCourseDateTime(s.startAt)}</td><td>{formatCourseDateTime(s.endAt)}</td></tr>)}</tbody></Table></div></>}
        </div>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" disabled={saving} onClick={onClose}>Hủy</Button><Button type="submit" variant="danger" disabled={saving||loading||!currentPreview||!availability.ready||!rooms.length||!coaches.length}>{saving?'Đang lưu…':'Tạo đợt và lịch học'}</Button></Modal.Footer>
    </Form>
  </Modal>;
}
