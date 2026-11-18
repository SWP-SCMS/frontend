import { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { getMySessionTraining } from '../../../services/sessionTrainingService';

export default function SessionTrainingSummary({ sessionId, course }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(getMySessionTraining(sessionId, course)
      .then(value => { commitValue(setSummary, value); commitError(setError, null); })
      .catch(err => { failed(err); commitError(setError, err); })
      .finally(() => { if (!background) commitValue(setLoading, false); }));
  }, [sessionId, course, retry]);

  if (loading) return <div className="py-3" role="status"><Spinner size="sm" animation="border" /> Đang tải kết quả và nhận xét…</div>;
  if (error) return <div className="mt-3">
    <ErrorAlert error={error} title="Không tải được kết quả và nhận xét" />
    <Button variant="outline-secondary" size="sm" onClick={() => { setLoading(true); setError(null); setRetry(value => value + 1); }}>Thử lại</Button>
  </div>;

  return <>
    <section className="mcs-mfeedback" aria-labelledby="session-result-title">
      <h3 className="mcs-mfeedback-title" id="session-result-title">Kết quả tập luyện</h3>
      {summary?.result ? <div className="mcs-mfeedback-text"><TrainingContent value={summary.result.content} /></div>
        : <p className="mcs-mfeedback-empty">HLV chưa ghi kết quả cho buổi này.</p>}
    </section>
    <section className="mcs-mfeedback" aria-labelledby="session-feedback-title">
      <h3 className="mcs-mfeedback-title" id="session-feedback-title">Nhận xét của HLV</h3>
      {summary?.feedback ? <p className="mcs-mfeedback-text">{summary.feedback.content}</p>
        : <p className="mcs-mfeedback-empty">HLV chưa gửi nhận xét cho buổi này.</p>}
    </section>
  </>;
}
