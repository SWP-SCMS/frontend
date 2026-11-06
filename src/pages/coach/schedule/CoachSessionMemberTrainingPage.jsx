import usePollingEffect from '../../../hooks/usePollingEffect';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import { getCoachSession } from '../../../services/coachScheduleService';
import { saveSessionTrainingResult, saveSessionTrainingFeedback } from '../../../services/sessionTrainingService';
import SessionTrainingEditor from './SessionTrainingEditor';
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
  }, [memberAccountId, sessionId], !busy);

  const member = session?.members?.find(item => item.memberId === memberAccountId);
  const canWrite = !!session && ['GROUP', 'YOGA'].includes(session.classType) && (!!member || !!result);
  const resultText = typeof result?.content?.notes === 'string' ? result.content.notes : '';
  async function saveResult(content) {
    const data = await saveSessionTrainingResult(sessionId, memberAccountId, result?.id, {
      activityAt: result?.activityAt || session.startTime,
      // Giữ nguyên bài tập/chỉ số đã có, chỉ cập nhật ghi chú của form này.
      content: { ...result?.content, notes: content },
    });
    setResult(data);
    return data.content?.notes || '';
  }
  async function saveFeedback(content) {
    const data = await saveSessionTrainingFeedback(sessionId, memberAccountId, feedback?.id, { trainingResultId: result.id, content });
    setFeedback(data);
    return data.content;
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
      <p className="text-muted">{member?.fullName || 'Học viên'} · {session?.className || 'Buổi tập'}. Lưu kết quả trước khi ghi nhận xét.</p>
      <ErrorAlert error={error} title="Không tải được kết quả và nhận xét" />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : !error ? (
        <Row className="g-3">
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h2 className="h5">Kết quả tập luyện</h2>
              {result ? <TrainingContent value={result.content ?? result} /> : <p className="text-muted mb-0">Chưa ghi nhận kết quả cho buổi này.</p>}
              <SessionTrainingEditor label="Kết quả tập luyện" value={resultText} disabled={!canWrite || busy} onSave={saveResult} onBusy={setBusy} />
            </Card.Body></Card>
          </Col>
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h2 className="h5">Nhận xét của huấn luyện viên</h2>
              {feedback ? <TrainingContent value={feedback.content ?? feedback} /> : <p className="text-muted mb-0">Chưa có nhận xét cho buổi này.</p>}
              {!result ? <p className="text-muted mt-3">Cần lưu kết quả tập luyện trước khi thêm nhận xét.</p> : null}
              <SessionTrainingEditor label="Nhận xét" value={feedback?.content || ''} disabled={!canWrite || !result?.id || busy} onSave={saveFeedback} onBusy={setBusy} />
            </Card.Body></Card>
          </Col>
        </Row>
      ) : null}
      <Link to={`/coach/schedule/${sessionId}/students`} className="d-inline-block mt-3">← Quay lại danh sách học viên</Link>
    </div>
  );
}
