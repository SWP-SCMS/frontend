import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  createManualActivationRequest,
  getReceptionManualActivationRequest,
  listReceptionManualActivationRequests,
  searchPendingVerificationAccount,
} from '../../../services/emailVerificationService';
import { formatDateTime } from '../../../utils';

const schema = z.object({
  reasonCode: z.enum(['EMAIL_DELIVERY_FAILED', 'MEMBER_CANNOT_ACCESS_EMAIL', 'ACCESSIBILITY_SUPPORT', 'OTHER']),
  reasonDetail: z.string().trim().min(1, 'Vui lòng ghi lý do.').max(1000),
  verificationMethod: z.enum(['IN_PERSON_GOVERNMENT_ID_CHECK', 'IN_PERSON_PROFILE_AND_REGISTERED_PHONE_MATCH', 'OTHER_APPROVED_PROCEDURE']),
  evidenceNote: z.string().trim().min(1, 'Vui lòng ghi bằng chứng xác minh.').max(2000),
  identityChecked: z.literal(true, { error: 'Phải xác nhận đã kiểm tra danh tính trực tiếp.' }),
});

const STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

export default function ManualActivationPage() {
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState(null);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState('');
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      reasonCode: 'EMAIL_DELIVERY_FAILED', reasonDetail: '',
      verificationMethod: 'IN_PERSON_GOVERNMENT_ID_CHECK', evidenceNote: '', identityChecked: false,
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setResult(await listReceptionManualActivationRequests({ status, page, size: 20 })); }
    catch (err) { setError(err); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  async function search(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setError(null); setAccount(null);
    try { setAccount(await searchPendingVerificationAccount(query)); }
    catch (err) { setError(err); }
    finally { setSearching(false); }
  }

  async function submit(values) {
    if (!account) return;
    setError(null);
    try {
      await createManualActivationRequest({ memberId: account.memberId, ...values });
      setNotice('Đã gửi yêu cầu kích hoạt để Manager phê duyệt.');
      setAccount(null); setQuery(''); form.reset();
      if (status === 'PENDING' && page === 0) await load();
      else { setStatus('PENDING'); setPage(0); }
    } catch (err) { setError(err); }
  }

  async function openDetail(id) {
    setError(null);
    try { setDetail(await getReceptionManualActivationRequest(id)); }
    catch (err) { setError(err); }
  }

  return <div>
    <h1 className="h3 fw-bold mb-1">Yêu cầu kích hoạt tài khoản</h1>
    <p className="text-muted">Xác minh danh tính trực tiếp và gửi yêu cầu để Manager phê duyệt.</p>
    {notice ? <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert> : null}
    <ErrorAlert error={error} title="Không xử lý được yêu cầu" onClose={() => setError(null)} />

    <Card className="border-0 shadow-sm mb-4"><Card.Body>
      <Form onSubmit={search} className="d-flex gap-2 align-items-end">
        <Form.Group className="flex-grow-1">
          <Form.Label>Mã hội viên, số điện thoại hoặc email</Form.Label>
          <Form.Control value={query} onChange={(e) => setQuery(e.target.value)} />
        </Form.Group>
        <Button type="submit" variant="outline-danger" disabled={searching || !query.trim()}>{searching ? 'Đang tìm…' : 'Tra cứu'}</Button>
      </Form>
      {account ? <div className="border rounded p-3 mt-3">
        <div className="fw-semibold">{account.fullName} · {account.memberId}</div>
        <div className="small text-muted">{account.phone} · {account.maskedEmail} · Hết hạn {formatDateTime(account.registrationExpiresAt)}</div>
        <Form className="mt-3" onSubmit={form.handleSubmit(submit)} noValidate>
          <Form.Group className="mb-3"><Form.Label>Lý do</Form.Label><Form.Select {...form.register('reasonCode')}>
            <option value="EMAIL_DELIVERY_FAILED">Không nhận được email</option><option value="MEMBER_CANNOT_ACCESS_EMAIL">Không truy cập được email</option><option value="ACCESSIBILITY_SUPPORT">Cần hỗ trợ tiếp cận</option><option value="OTHER">Khác</option>
          </Form.Select></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Mô tả lý do *</Form.Label><Form.Control as="textarea" rows={2} {...form.register('reasonDetail')} isInvalid={Boolean(form.formState.errors.reasonDetail)} /><Form.Control.Feedback type="invalid">{form.formState.errors.reasonDetail?.message}</Form.Control.Feedback></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Phương thức xác minh</Form.Label><Form.Select {...form.register('verificationMethod')}>
            <option value="IN_PERSON_GOVERNMENT_ID_CHECK">Đối chiếu giấy tờ tùy thân</option><option value="IN_PERSON_PROFILE_AND_REGISTERED_PHONE_MATCH">Đối chiếu hồ sơ và SĐT đăng ký</option><option value="OTHER_APPROVED_PROCEDURE">Quy trình được duyệt khác</option>
          </Form.Select></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Bằng chứng/ghi chú xác minh *</Form.Label><Form.Control as="textarea" rows={3} {...form.register('evidenceNote')} isInvalid={Boolean(form.formState.errors.evidenceNote)} /><Form.Control.Feedback type="invalid">{form.formState.errors.evidenceNote?.message}</Form.Control.Feedback></Form.Group>
          <Form.Check type="checkbox" className="mb-1" label="Tôi xác nhận đã kiểm tra danh tính trực tiếp" {...form.register('identityChecked')} isInvalid={Boolean(form.formState.errors.identityChecked)} />
          {form.formState.errors.identityChecked ? <div className="text-danger small mb-3">{form.formState.errors.identityChecked.message}</div> : null}
          <Button type="submit" variant="danger" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu phê duyệt'}</Button>
        </Form>
      </div> : null}
    </Card.Body></Card>

    <div className="d-flex justify-content-between align-items-end mb-2"><h2 className="h5 mb-0">Yêu cầu của tôi</h2><Form.Select style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUS.map((item) => <option key={item}>{item}</option>)}</Form.Select></div>
    <Card className="border-0 shadow-sm"><Card.Body className="p-0">
      {loading ? <div className="text-center p-4"><Spinner variant="danger" /></div> : <Table responsive hover className="mb-0"><thead><tr><th>Hội viên</th><th>Lý do</th><th>Trạng thái</th><th>Ngày gửi</th><th /></tr></thead><tbody>{(result?.content || []).map((item) => <tr key={item.requestId}><td>{item.memberId}<div className="small text-muted">{item.maskedEmail}</div></td><td>{item.reasonCode}</td><td><Badge bg={item.status === 'APPROVED' ? 'success' : item.status === 'PENDING' ? 'warning' : 'secondary'}>{item.status}</Badge></td><td>{formatDateTime(item.requestedAt)}</td><td><Button size="sm" variant="outline-danger" onClick={() => openDetail(item.requestId)}>Chi tiết</Button></td></tr>)}</tbody></Table>}
    </Card.Body></Card>
    <div className="d-flex justify-content-between mt-2"><Button size="sm" variant="outline-secondary" disabled={page <= 0} onClick={() => setPage((x) => x - 1)}>Trang trước</Button><Button size="sm" variant="outline-secondary" disabled={page + 1 >= (result?.totalPages || 0)} onClick={() => setPage((x) => x + 1)}>Trang sau</Button></div>

    <Modal show={Boolean(detail)} onHide={() => setDetail(null)} centered><Modal.Header closeButton><Modal.Title>Chi tiết yêu cầu</Modal.Title></Modal.Header><Modal.Body>{detail ? <dl className="row mb-0 small"><dt className="col-5">Hội viên</dt><dd className="col-7">{detail.memberId}</dd><dt className="col-5">Lý do</dt><dd className="col-7">{detail.reasonDetail}</dd><dt className="col-5">Cách xác minh</dt><dd className="col-7">{detail.verificationMethod}</dd><dt className="col-5">Bằng chứng</dt><dd className="col-7">{detail.evidenceNote}</dd><dt className="col-5">Quyết định</dt><dd className="col-7">{detail.decisionNote || '—'}</dd></dl> : null}</Modal.Body></Modal>
  </div>;
}
