import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Spinner } from 'react-bootstrap';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import {
  listCoachTrainingFeedback,
  listCoachTrainingPlans,
  listCoachTrainingResults,
} from '../../../services/trainingService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const CONFIG = {
  plans: {
    title: 'Giáo án tập luyện',
    emptyTitle: 'Chưa có giáo án',
    emptyMessage: 'Hội viên chưa có giáo án tập luyện nào.',
    load: listCoachTrainingPlans,
  },
  results: {
    title: 'Kết quả tập luyện',
    emptyTitle: 'Chưa có kết quả',
    emptyMessage: 'Chưa có kết quả tập luyện nào được ghi nhận.',
    load: listCoachTrainingResults,
  },
  feedback: {
    title: 'Nhận xét huấn luyện',
    emptyTitle: 'Chưa có nhận xét',
    emptyMessage: 'Chưa có nhận xét nào dành cho hội viên.',
    load: listCoachTrainingFeedback,
  },
};

function displayTime(item) {
  const value = item.updatedAt || item.activityAt || item.createdAt;
  return value ? `${formatGymDate(value)} · ${formatGymTime(value)}` : null;
}

export default function CoachMemberTrainingPage({ kind }) {
  const { memberAccountId } = useParams();
  const config = CONFIG[kind];
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await config.load(memberAccountId, { page, size: 20 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [config, memberAccountId, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <WorkflowBreadcrumb
        items={[
          { to: '/coach/members', label: 'Hội viên được phân công' },
          { to: `/coach/members/${memberAccountId}`, label: 'Hồ sơ hội viên' },
        ]}
        current={config.title}
      />
      <h1 className="h3 fw-bold mt-3">{config.title}</h1>
      <p className="text-muted">Lịch sử do bạn quản lý cho hội viên này.</p>
      <ErrorAlert error={error} title={`Không tải được ${config.title.toLocaleLowerCase('vi-VN')}`} />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : !result?.content?.length ? (
        <EmptyState title={config.emptyTitle} message={config.emptyMessage} />
      ) : (
        result.content.map((item, index) => (
          <Card key={item.id || `${kind}-${index}`} className="border-0 shadow-sm mb-3">
            <Card.Body>
              <div className="d-flex justify-content-between gap-3 mb-2">
                <h2 className="h6 mb-0">{item.title || `${config.title} ${index + 1}`}</h2>
                {displayTime(item) ? <span className="small text-muted">{displayTime(item)}</span> : null}
              </div>
              <TrainingContent value={item.content ?? item} />
            </Card.Body>
          </Card>
        ))
      )}
      <div className="d-flex justify-content-between mt-3">
        <Button size="sm" variant="outline-danger" disabled={loading || page <= 0} onClick={() => setPage((value) => value - 1)}>‹ Trang trước</Button>
        <Button size="sm" variant="outline-danger" disabled={loading || !result || page + 1 >= result.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau ›</Button>
      </div>
      <Link to={`/coach/members/${memberAccountId}`} className="d-inline-block mt-3">← Quay lại hồ sơ hội viên</Link>
    </div>
  );
}
