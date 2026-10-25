import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spinner } from 'react-bootstrap';
import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import TrainingContent from '../../../components/common/TrainingContent';
import { listMyTrainingFeedback } from '../../../services/trainingService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

export default function MemberTrainingFeedbackPage() {
  const [page, setPage] = useState(0); const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setResult(await listMyTrainingFeedback({ page, size: 20 })); } catch (err) { setError(err); } finally { setLoading(false); } }, [page]);
  useEffect(() => { load(); }, [load]);
  return <div><h1 className="h3 fw-bold">Nhận xét của huấn luyện viên</h1><p className="text-muted">Lịch sử nhận xét vẫn xem được sau khi gói tập hết hạn.</p><ErrorAlert error={error} title="Không tải được nhận xét" />{loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : !result?.content.length ? <EmptyState title="Chưa có nhận xét" message="Huấn luyện viên chưa gửi nhận xét nào." /> : result.content.map((item) => <Card key={item.id} className="border-0 shadow-sm mb-2"><Card.Body><div className="fw-semibold">{item.className || item.sessionName || 'Buổi huấn luyện cá nhân'}</div><div className="small text-muted mb-2">HLV {item.coachName || '—'} · {formatGymDate(item.sessionStartTime || item.createdAt)} · {formatGymTime(item.sessionStartTime || item.createdAt)}</div><TrainingContent value={item.content} /></Card.Body></Card>)}{(result?.totalPages || 0) > 1 ? <div className="d-flex justify-content-between mt-3"><Button size="sm" variant="outline-danger" disabled={loading || page <= 0} onClick={() => setPage((v) => v - 1)}>‹ Trang trước</Button><span className="small text-muted align-self-center">Trang {page + 1}/{result.totalPages}</span><Button size="sm" variant="outline-danger" disabled={loading || page + 1 >= result.totalPages} onClick={() => setPage((v) => v + 1)}>Trang sau ›</Button></div> : null}</div>;
}
