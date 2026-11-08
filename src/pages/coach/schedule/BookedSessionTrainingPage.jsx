import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { getCoachSession } from '../../../services/coachScheduleService';
import { getCoachCourseSession, getCoachCourseRoster } from '../../../services/courseCoachService';
import { getBookedSessionTraining, saveBookedSessionTraining } from '../../../services/sessionTrainingService';
import { listCoachTrainingPlans, listCoachTrainingPlanVersions } from '../../../services/trainingService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import CoachSessionMemberTrainingPage from './CoachSessionMemberTrainingPage';

async function planOptions(memberId) {
  const plans = [];
  for (let page = 0; ; page += 1) {
    const data = await listCoachTrainingPlans(memberId, { page, size: 100 });
    plans.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  const versions = await Promise.all(plans.map(async plan => (await listCoachTrainingPlanVersions(memberId, plan.id))
    .map(version => ({ id: version.id, label: `${plan.title} · Phiên bản ${version.versionNumber}` }))));
  return versions.flat();
}

export default function BookedSessionTrainingPage({ course = false }) {
  const { sessionId, memberAccountId } = useParams();
  return <TrainingPage key={`${course}/${sessionId}/${memberAccountId}`} course={course} sessionId={sessionId} memberId={memberAccountId} />;
}

function TrainingPage({ course, sessionId, memberId }) {
  const [session, setSession] = useState(null);
  const [memberName, setMemberName] = useState('Hội viên');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ notes: '', feedback: '', trainingPlanVersionId: '' });
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track((async () => {
      try {
        const detail = await (course ? getCoachCourseSession(sessionId) : getCoachSession(sessionId));
        commitValue(setSession, detail);
        if (!course && detail.classType !== 'PT_1_1') return;
        const data = await getBookedSessionTraining(sessionId, memberId, course);
        commitValue(setSummary, data);
        if (!course) commitValue(setMemberName, detail.members?.find(member => member.memberId === memberId)?.fullName || 'Hội viên');
        else {
          const roster = await getCoachCourseRoster(sessionId);
          commitValue(setMemberName, roster.find(row => row.memberAccountId === memberId)?.fullName || 'Hội viên');
        }
        commitError(setError, null);
      } catch (err) { failed(err); commitError(setError, err); }
      finally { if (!background) commitValue(setLoading, false); }
    })());
  }, [course, sessionId, memberId], !editing && !busy);

  async function openEditor() {
    setDraft({ notes: summary?.result?.content?.notes || '', feedback: summary?.feedback?.content || '', trainingPlanVersionId: summary?.result?.trainingPlanVersionId || '' });
    setSaveError(null); setOptionsError(null); setSaved(false); setEditing(true);
    if (!course) {
      setOptionsLoading(true);
      try { setOptions(await planOptions(memberId)); }
      catch (err) { setOptionsError(err); }
      finally { setOptionsLoading(false); }
    }
  }

  async function save(event) {
    event.preventDefault();
    if (lock.current || !summary?.writable || optionsLoading || optionsError) return;
    if (!draft.notes.trim() || !draft.feedback.trim() || (!course && !options.some(option => option.id === draft.trainingPlanVersionId))) {
      setSaveError(new Error('Vui lòng nhập đầy đủ kết quả, nhận xét và chọn giáo án cho buổi PT.'));
      return;
    }
    lock.current = true; setBusy(true); setSaveError(null);
    try {
      const data = await saveBookedSessionTraining(sessionId, memberId, course, {
        notes: draft.notes.trim(), feedback: draft.feedback.trim(),
        trainingPlanVersionId: course ? null : draft.trainingPlanVersionId,
      });
      setSummary(data); setEditing(false); setSaved(true);
    } catch (err) { setSaveError(err); }
    finally { lock.current = false; setBusy(false); }
  }

  if (session && !course && session.classType !== 'PT_1_1') return <CoachSessionMemberTrainingPage />;
  const back = course ? `/coach/course-sessions?session=${sessionId}` : `/coach/schedule/${sessionId}/students`;
  const start = course ? session?.startsAt : session?.startTime;
  return <div>
    <WorkflowBreadcrumb items={[{ to: back, label: course ? 'Buổi khóa học' : 'Học viên buổi PT' }]} current="Kết quả và nhận xét" />
    <h1 className="h3 fw-bold mt-3">Kết quả và nhận xét {course ? 'buổi khóa học' : 'buổi PT'}</h1>
    <p className="text-muted">{memberName} · {session?.courseName || session?.className || 'Buổi tập'}{course && session ? ` · Buổi ${session.unitNumber}` : ''}</p>
    {start && <p>Thời gian tập: <strong>{formatGymDate(start)} · {formatGymTime(start)}</strong> (giờ Việt Nam)</p>}
    <ErrorAlert error={error} title="Không tải được kết quả và nhận xét" />
    {loading ? <Spinner animation="border" /> : !error && summary ? <>
      {!summary.writable && <Alert variant="info">Chỉ ghi kết quả sau khi buổi tập kết thúc, buổi không bị hủy và hội viên còn trong danh sách buổi tập.</Alert>}
      <Button className="mb-3" variant="danger" disabled={!summary.writable} onClick={openEditor}>{summary.result ? 'Chỉnh sửa kết quả và nhận xét' : 'Ghi kết quả và nhận xét'}</Button>
      {saved && <Alert variant="success">Đã lưu kết quả và nhận xét vào lịch sử hội viên.</Alert>}
      <Card className="border-0 shadow-sm"><Card.Body>
        <h2 className="h5">Kết quả tập luyện</h2>
        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{summary.result ? <TrainingContent value={summary.result.content} /> : <p className="text-muted">Chưa ghi nhận kết quả.</p>}</div>
        <h2 className="h5 border-top mt-4 pt-3">Nhận xét</h2>
        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{summary.feedback?.content || 'Chưa có nhận xét.'}</div>
      </Card.Body></Card>
    </> : null}
    <Link to={back} className="d-inline-block mt-3">← Quay lại buổi tập</Link>
    <Modal show={editing} onHide={() => !busy && !optionsLoading && setEditing(false)} centered size="lg" backdrop="static" keyboard={!busy && !optionsLoading}>
      <Form onSubmit={save}>
        <Modal.Header closeButton={!busy && !optionsLoading}><Modal.Title className="h5">Kết quả và nhận xét</Modal.Title></Modal.Header>
        <Modal.Body>
          <p>{memberName} · {formatGymDate(start)} · {formatGymTime(start)} (giờ Việt Nam)</p>
          <ErrorAlert error={saveError} title="Không lưu được kết quả và nhận xét" />
          <ErrorAlert error={optionsError} title="Không tải được giáo án" />
          <fieldset disabled={busy || optionsLoading || Boolean(optionsError)}>
            {!course && <Form.Group className="mb-3" controlId="session-plan-version">
              <Form.Label>Giáo án đã tập *</Form.Label>
              <Form.Select required value={draft.trainingPlanVersionId} onChange={event => setDraft(value => ({ ...value, trainingPlanVersionId: event.target.value }))}>
                <option value="">{optionsLoading ? 'Đang tải giáo án…' : 'Chọn giáo án và phiên bản'}</option>
                {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </Form.Select>
              {!optionsLoading && !optionsError && !options.length && <Form.Text>Cần tạo giáo án cho hội viên trước khi ghi kết quả buổi PT.</Form.Text>}
            </Form.Group>}
            <Form.Group className="mb-3" controlId="booked-training-notes">
              <Form.Label>Kết quả tập luyện *</Form.Label>
              <Form.Control as="textarea" rows={4} maxLength={4000} required value={draft.notes} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} />
            </Form.Group>
            <Form.Group controlId="booked-training-feedback">
              <Form.Label>Nhận xét *</Form.Label>
              <Form.Control as="textarea" rows={4} maxLength={4000} required value={draft.feedback} onChange={event => setDraft(value => ({ ...value, feedback: event.target.value }))} />
            </Form.Group>
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={busy || optionsLoading} onClick={() => setEditing(false)}>Hủy</Button>
          <Button variant="danger" type="submit" disabled={busy || optionsLoading || Boolean(optionsError) || (!course && !options.length)}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  </div>;
}
