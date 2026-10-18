import { useEffect, useState } from 'react';
import { Accordion, Card, Spinner } from 'react-bootstrap';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import { listMyTrainingPlans } from '../../../services/trainingService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

export default function MemberTrainingPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    listMyTrainingPlans().then((data) => { if (!cancelled) setPlans(data); }).catch((err) => { if (!cancelled) setError(err); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return <div><h1 className="h3 fw-bold">Giáo án tập luyện</h1><p className="text-muted">Lịch sử giáo án và các phiên bản bất biến.</p><ErrorAlert error={error} title="Không tải được giáo án" />{loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : plans.length === 0 ? <EmptyState title="Chưa có giáo án" message="Huấn luyện viên chưa tạo giáo án cho bạn." /> : plans.map((plan) => <Card key={plan.id} className="border-0 shadow-sm mb-3"><Card.Body><h2 className="h5">{plan.title}</h2><div className="small text-muted mb-2">{plan.status} · cập nhật {formatGymDate(plan.updatedAt)} {formatGymTime(plan.updatedAt)}</div><Accordion>{(plan.versions || []).map((version) => <Accordion.Item key={version.id} eventKey={String(version.versionNumber)}><Accordion.Header>Phiên bản {version.versionNumber}</Accordion.Header><Accordion.Body><TrainingContent value={version.content} /></Accordion.Body></Accordion.Item>)}</Accordion></Card.Body></Card>)}</div>;
}
