import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  decideManualActivationRequest,
  getManagerManualActivationRequest,
  listManagerManualActivationRequests,
} from '../../../services/emailVerificationService';
import { formatDateTime } from '../../../utils';
import {
  activationReasonLabel,
  activationStatusLabel,
  verificationMethodLabel,
} from '../../../utils/emailVerificationUi';

const decisionSchema = z.object({ decisionNote: z.string().trim().min(1, 'Vui lòng ghi lý do quyết định.').max(1000) });
const STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

export default function ManualActivationReviewPage() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const form = useForm({ resolver: zodResolver(decisionSchema), defaultValues: { decisionNote: '' } });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setResult(await listManagerManualActivationRequests({ status, page, size: 20 })); }
    catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  async function open(id) {
    setError(null);
    try { setDetail(await getManagerManualActivationRequest(id)); }
    catch (err) { setError(err); }
  }

  function startDecision(type) { setDecision(type); form.reset({ decisionNote: '' }); }

  async function submit(values) {
    try {
      const updated = await decideManualActivationRequest(detail.requestId, decision, values.decisionNote);
      setDetail(updated); setDecision(null); setNotice(decision === 'APPROVE' ? 'Đã kích hoạt tài khoản.' : 'Đã từ chối yêu cầu.'); await load();
    } catch (err) { setError(err); }
  }

  return <div>
    <div className="d-flex justify-content-between align-items-end mb-3"><div><h1 className="h3 fw-bold mb-1">Phê duyệt kích hoạt tài khoản</h1><p className="text-muted mb-0">Kiểm tra bằng chứng do lễ tân ghi nhận trước khi quyết định.</p></div><Form.Select style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUS.map((item) => <option key={item} value={item}>{activationStatusLabel(item)}</option>)}</Form.Select></div>
    {notice ? <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert> : null}
    <ErrorAlert error={error} title="Không xử lý được yêu cầu" onClose={() => setError(null)} />
    <Card className="border-0 shadow-sm"><Card.Body className="p-0">{loading ? <div className="text-center p-4"><Spinner variant="danger" /></div> : <Table responsive hover className="mb-0"><thead><tr><th>Hội viên</th><th>Lý do</th><th>Trạng thái</th><th>Ngày gửi</th><th /></tr></thead><tbody>{(result?.content || []).map((item) => <tr key={item.requestId}><td>{item.memberId}<div className="small text-muted">{item.maskedEmail}</div></td><td>{activationReasonLabel(item.reasonCode)}</td><td><Badge bg={item.status === 'APPROVED' ? 'success' : item.status === 'PENDING' ? 'warning' : 'secondary'}>{activationStatusLabel(item.status)}</Badge></td><td>{formatDateTime(item.requestedAt)}</td><td><Button size="sm" variant="outline-danger" onClick={() => open(item.requestId)}>Xem</Button></td></tr>)}</tbody></Table>}</Card.Body></Card>
    <div className="d-flex justify-content-between mt-2"><Button size="sm" variant="outline-secondary" disabled={page <= 0} onClick={() => setPage((x) => x - 1)}>Trang trước</Button><Button size="sm" variant="outline-secondary" disabled={page + 1 >= (result?.totalPages || 0)} onClick={() => setPage((x) => x + 1)}>Trang sau</Button></div>

    <Modal show={Boolean(detail)} onHide={() => { setDetail(null); setDecision(null); }} centered size="lg"><Modal.Header closeButton><Modal.Title>Yêu cầu {detail?.memberId}</Modal.Title></Modal.Header><Modal.Body>{detail ? <><dl className="row small"><dt className="col-4">Email</dt><dd className="col-8">{detail.maskedEmail}</dd><dt className="col-4">Lý do</dt><dd className="col-8">{detail.reasonDetail}</dd><dt className="col-4">Phương thức</dt><dd className="col-8">{verificationMethodLabel(detail.verificationMethod)}</dd><dt className="col-4">Bằng chứng</dt><dd className="col-8" style={{ whiteSpace: 'pre-wrap' }}>{detail.evidenceNote}</dd><dt className="col-4">Hạn xử lý</dt><dd className="col-8">{formatDateTime(detail.expiresAt)}</dd><dt className="col-4">Trạng thái</dt><dd className="col-8">{activationStatusLabel(detail.status)}</dd>{detail.decisionNote ? <><dt className="col-4">Ghi chú quyết định</dt><dd className="col-8">{detail.decisionNote}</dd></> : null}</dl>{detail.status === 'PENDING' && !decision ? <div className="d-flex gap-2"><Button variant="success" onClick={() => startDecision('APPROVE')}>Phê duyệt</Button><Button variant="outline-danger" onClick={() => startDecision('REJECT')}>Từ chối</Button></div> : null}{decision ? <Form onSubmit={form.handleSubmit(submit)}><Form.Group><Form.Label>Ghi chú quyết định *</Form.Label><Form.Control as="textarea" rows={3} {...form.register('decisionNote')} isInvalid={Boolean(form.formState.errors.decisionNote)} /><Form.Control.Feedback type="invalid">{form.formState.errors.decisionNote?.message}</Form.Control.Feedback></Form.Group><div className="d-flex gap-2 mt-3"><Button type="submit" variant={decision === 'APPROVE' ? 'success' : 'danger'} disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Đang xử lý…' : 'Xác nhận'}</Button><Button variant="outline-secondary" onClick={() => setDecision(null)}>Hủy</Button></div></Form> : null}</> : null}</Modal.Body></Modal>
  </div>;
}
