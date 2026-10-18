import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import {
  getCoachSessionFeedback,
  getCoachSessionTrainingResult,
} from '../../../services/trainingService';

export default function CoachSessionMemberTrainingPage() {
  const { sessionId, memberAccountId } = useParams();
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCoachSessionTrainingResult(sessionId, memberAccountId),
      getCoachSessionFeedback(sessionId, memberAccountId),
    ])
      .then(([resultValue, feedbackValue]) => {
        if (!cancelled) {
          setResult(resultValue);
          setFeedback(feedbackValue);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberAccountId, sessionId]);

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
      <p className="text-muted">Thông tin đã ghi nhận cho học viên trong buổi tập này.</p>
      <ErrorAlert error={error} title="Không tải được kết quả và nhận xét" />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : (
        <Row className="g-3">
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h2 className="h5">Kết quả tập luyện</h2>
              {result ? <TrainingContent value={result.content ?? result} /> : <p className="text-muted mb-0">Chưa ghi nhận kết quả cho buổi này.</p>}
            </Card.Body></Card>
          </Col>
          <Col lg={6}>
            <Card className="border-0 shadow-sm h-100"><Card.Body>
              <h2 className="h5">Nhận xét của huấn luyện viên</h2>
              {feedback ? <TrainingContent value={feedback.content ?? feedback} /> : <p className="text-muted mb-0">Chưa có nhận xét cho buổi này.</p>}
            </Card.Body></Card>
          </Col>
        </Row>
      )}
      <Link to={`/coach/schedule/${sessionId}/students`} className="d-inline-block mt-3">← Quay lại danh sách học viên</Link>
    </div>
  );
}
