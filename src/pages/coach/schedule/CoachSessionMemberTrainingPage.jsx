import usePollingEffect from '../../../hooks/usePollingEffect';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import { getCoachSession } from '../../../services/coachScheduleService';
import { saveSessionTrainingSummary } from '../../../services/sessionTrainingService';
import {
  getCoachSessionFeedback,
  getCoachSessionTrainingResult,
} from '../../../services/trainingService';

export default function CoachSessionMemberTrainingPage() {
  const { sessionId, memberAccountId } = useParams();
  return <SessionTrainingPage key={`${sessionId}/${memberAccountId}`} sessionId={sessionId} memberAccountId={memberAccountId} />;
}

function SessionTrainingPage({ sessionId, memberAccountId }) {
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ notes: '', feedback: '' });
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const saveLock = useRef(false);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    let cancelled = false;
    track(Promise.all([
      getCoachSessionTrainingResult(sessionId, memberAccountId),
      getCoachSessionFeedback(sessionId, memberAccountId),
      getCoachSession(sessionId),
    ])
      .then(([resultValue, feedbackValue, sessionValue]) => {
        if (!cancelled) {
          commitValue(setResult, resultValue);
          commitValue(setFeedback, feedbackValue);
          commitValue(setSession, sessionValue);
        }
      })
      .catch((err) => { failed(err);
        if (!cancelled) commitError(setError, err);
      })
      .finally(() => {
        if (!cancelled) if (!background) commitValue(setLoading, false);
      }));
    return () => {
      cancelled = true;
    };
  }, [memberAccountId, sessionId], !busy && !editing);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const sessionEnded = !!session?.endTime && new Date(session.endTime).getTime() <= now;
  const sessionCancelled = session?.status === 'CANCELLED';
  const member = session?.members?.find(item => item.memberId === memberAccountId);
  const canWrite = !!session && sessionEnded && !sessionCancelled && ['GROUP', 'YOGA'].includes(session.classType) && (!!member || !!result);
  const resultText = typeof result?.content?.notes === 'string' ? result.content.notes : '';
  function openEditor() {
    setDraft({ notes: resultText, feedback: feedback?.content || '' });
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  }
  async function saveSummary(event) {
    event.preventDefault();
    if (!canWrite || saveLock.current) return;
    if (!draft.notes.trim() || !draft.feedback.trim()) {
      setSaveError(new Error('Vui lòng nhập cả kết quả tập luyện và nhận xét.'));
      return;
    }
    saveLock.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      const data = await saveSessionTrainingSummary(sessionId, memberAccountId, {
        notes: draft.notes.trim(), feedback: draft.feedback.trim(),
      });
      setResult(data.result);
      setFeedback(data.feedback);
      setEditing(false);
      setSaved(true);
    } catch (err) { setSaveError(err); }
    finally { saveLock.current = false; setBusy(false); }
  }

  return (
    <div>
      <WorkflowBreadcrumb
        items={[
          { to: `/coach/schedule/${sessionId}`, label: 'Chi tiết buổi tập' },
          { to: `/coach/schedule/${sessionId}/students`, label: 'Danh sách học viên' },
        ]}
        current="Kết quả và nhận xét"
      />
      <h1 className="h3 fw-bold mt-3">Kết quả và nhận xét buổi tập</h1>
      <p className="text-muted">{member?.fullName || 'Học viên'} · {session?.className || 'Buổi tập'}</p>
      <div className="mb-3"><Button onClick={openEditor} disabled={loading || !!error || !canWrite}>{result || feedback ? 'Chỉnh sửa kết quả và nhận xét' : 'Ghi kết quả và nhận xét'}</Button></div>
      {saved && <Alert variant="success" role="status">Đã lưu kết quả và nhận xét.</Alert>}
      <ErrorAlert error={error} title="Không tải được kết quả và nhận xét" />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : !error ? (
        <Card className="border-0 shadow-sm"><Card.Body className="p-4">
              {!sessionEnded || sessionCancelled ? <Alert variant="secondary">{sessionCancelled ? 'Buổi tập đã hủy, không thể ghi kết quả hoặc nhận xét.' : 'Có thể ghi kết quả và nhận xét sau khi buổi tập kết thúc.'}</Alert> : null}
              <section>
              <h2 className="h5">Kết quả tập luyện</h2>
              {result ? <TrainingContent value={result.content ?? result} /> : <p className="text-muted mb-0">Chưa ghi nhận kết quả cho buổi này.</p>}
              </section>
              <section className="border-top mt-4 pt-4">
              <h2 className="h5">Nhận xét của huấn luyện viên</h2>
              {feedback ? <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><TrainingContent value={feedback.content ?? feedback} /></div> : <p className="text-muted mb-0">Chưa có nhận xét cho buổi này.</p>}
              </section>
        </Card.Body></Card>
      ) : null}
      <Modal show={editing} onHide={() => !busy && setEditing(false)} centered backdrop="static" keyboard={!busy}>
        <Form onSubmit={saveSummary}>
          <Modal.Header closeButton={!busy}><Modal.Title>Kết quả và nhận xét</Modal.Title></Modal.Header>
          <Modal.Body>
            <p className="text-muted">{member?.fullName || 'Học viên'} · {session?.className}</p>
            <ErrorAlert error={saveError} />
            {!canWrite && <Alert variant="secondary">Buổi tập chưa kết thúc hoặc đã bị hủy.</Alert>}
            <Form.Group controlId="training-summary-notes" className="mb-3">
              <Form.Label>Kết quả tập luyện</Form.Label>
              <Form.Control as="textarea" rows={4} value={draft.notes} disabled={busy || !canWrite} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
            </Form.Group>
            <Form.Group controlId="training-summary-feedback">
              <Form.Label>Nhận xét</Form.Label>
              <Form.Control as="textarea" rows={4} value={draft.feedback} disabled={busy || !canWrite} onChange={e => setDraft(d => ({ ...d, feedback: e.target.value }))} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" disabled={busy} onClick={() => setEditing(false)}>Hủy</Button>
            <Button type="submit" disabled={busy || !canWrite}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Link to={`/coach/schedule/${sessionId}/students`} className="d-inline-block mt-3">← Quay lại danh sách học viên</Link>
    </div>
  );
}
