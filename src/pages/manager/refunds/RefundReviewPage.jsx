import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  finalApproveRefundRequest,
  firstApproveRefundRequest,
  listManagerRefundRequests,
  rejectRefundRequest,
} from '../../../services/refundService';
import { formatDateTime, formatPrice } from '../../../utils';

const PAGE_SIZE = 20;

const STATUS = {
  REQUESTED: ['Chờ duyệt bước đầu', 'warning'],
  FIRST_APPROVED: ['Chờ Lễ tân chi tiền', 'info'],
  CASH_DISBURSED: ['Chờ xác nhận hoàn tất', 'primary'],
  COMPLETED: ['Đã hoàn tất', 'success'],
  REJECTED: ['Đã từ chối', 'danger'],
  CANCELLED: ['Đã hủy', 'secondary'],
};

const TYPE = {
  TERMINATED_MEMBERSHIP: 'Gói đã chấm dứt',
  RESERVED_CANCELLATION: 'Hủy gói đặt trước',
};

const EMPTY_PAGE = {
  content: [],
  page: 0,
  totalElements: 0,
  totalPages: 0,
};

function statusBadge(status) {
  const [label, variant] = STATUS[status] || [status || '—', 'secondary'];
  return <Badge bg={variant}>{label}</Badge>;
}

function messageOf(error, fallback) {
  const problem = error?.response?.data;
  const known = {
    REFUND_NOT_FOUND: 'Yêu cầu hoàn tiền không còn tồn tại.',
    REFUND_NOT_ELIGIBLE: 'Thanh toán hoặc gói tập không còn đủ điều kiện hoàn tiền.',
    REFUND_AMOUNT_EXCEEDS_LIMIT: 'Số tiền duyệt vượt mức yêu cầu hoặc mức hoàn tối đa.',
    REFUND_INVALID_TRANSITION: 'Yêu cầu không còn ở trạng thái cho phép thao tác này.',
    REFUND_REQUEST_CHANGED: 'Yêu cầu đã được người khác cập nhật. Hãy tải lại.',
    REFUND_REMAINING_DAYS_BELOW_THRESHOLD: 'Thời gian còn lại của gói thấp hơn ngưỡng được hoàn tiền.',
    VALIDATION_ERROR: 'Dữ liệu xử lý hoàn tiền chưa hợp lệ.',
  };
  return known[problem?.code] || problem?.detail || fallback;
}

export default function RefundReviewPage() {
  const [result, setResult] = useState(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [action, setAction] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listManagerRefundRequests({ page, size: PAGE_SIZE }));
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không tải được danh sách hoàn tiền.')));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openAction(kind, row) {
    setError(null);
    setAction({ kind, row });
    setRejectionReason('');
    if (kind === 'first-approve') {
      const requested = Number(row.requestedAmount);
      const suggested = Number(row.suggestedAmount);
      setApprovedAmount(String(Math.min(requested, suggested)));
    } else {
      setApprovedAmount('');
    }
  }

  function closeAction() {
    if (submitting) return;
    setAction(null);
    setApprovedAmount('');
    setRejectionReason('');
  }

  async function submitAction() {
    if (!action) return;
    const { kind, row } = action;
    const amountText = approvedAmount.trim();
    const reason = rejectionReason.trim();

    if (kind === 'first-approve' && !/^[1-9][0-9]*$/.test(amountText)) {
      setError(new Error('Số tiền duyệt phải là số nguyên lớn hơn 0.'));
      return;
    }
    if (kind === 'reject' && !reason) {
      setError(new Error('Vui lòng nhập lý do từ chối.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'first-approve') {
        await firstApproveRefundRequest(row.id, {
          expectedVersion: row.version,
          approvedAmount: Number(amountText),
        });
        setNotice('Đã duyệt bước đầu. Yêu cầu đang chờ Lễ tân giao tiền mặt.');
      } else if (kind === 'final-approve') {
        await finalApproveRefundRequest(row.id, {
          expectedVersion: row.version,
          reason: null,
        });
        setNotice('Đã xác nhận hoàn tiền hoàn tất.');
      } else {
        await rejectRefundRequest(row.id, {
          expectedVersion: row.version,
          reason,
        });
        setNotice('Đã từ chối yêu cầu hoàn tiền.');
      }
      setAction(null);
      setApprovedAmount('');
      setRejectionReason('');
      await load();
    } catch (requestError) {
      setError(new Error(messageOf(requestError, 'Không thể cập nhật yêu cầu hoàn tiền.')));
    } finally {
      setSubmitting(false);
    }
  }

  const rows = result.content || [];
  const modalTitle = action?.kind === 'first-approve'
    ? 'Duyệt hoàn tiền bước đầu'
    : action?.kind === 'final-approve'
      ? 'Xác nhận hoàn tiền hoàn tất'
      : 'Từ chối yêu cầu hoàn tiền';

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Duyệt hoàn tiền</h1>
          <p className="text-muted mb-0">Duyệt số tiền, theo dõi việc giao tiền mặt và xác nhận hoàn tất.</p>
        </div>
        <Button variant="outline-secondary" onClick={load} disabled={loading}>Tải lại</Button>
      </div>

      <Alert variant="warning" className="small">
        Danh sách hoàn tiền hiện chưa có mã đơn, mã giao dịch và tên hội viên. Mã hệ thống được hiển thị tạm thời để kiểm tra quy trình.
      </Alert>
      {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
      {error ? <ErrorAlert error={error} title="Không thể xử lý hoàn tiền" onClose={() => setError(null)} /> : null}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
          ) : rows.length === 0 ? (
            <p className="text-muted mb-0">Chưa có yêu cầu hoàn tiền.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead><tr><th>Ngày gửi</th><th>Hội viên</th><th>Nguồn hoàn</th><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th className="text-end">Thao tác</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.requestedAt)}</td>
                    <td><code className="small">{row.memberAccountId}</code></td>
                    <td>
                      <div className="small">Payment: <code>{row.paymentId}</code></div>
                      <div className="small">Membership: <code>{row.membershipId}</code></div>
                    </td>
                    <td>{TYPE[row.type] || row.type || '—'}</td>
                    <td>
                      <div>Yêu cầu: <strong>{formatPrice(row.requestedAmount, 'VND')}</strong></div>
                      <div className="small text-muted">Đề xuất: {formatPrice(row.suggestedAmount, 'VND')}</div>
                      {row.approvedAmount != null ? <div className="small text-success">Được duyệt: {formatPrice(row.approvedAmount, 'VND')}</div> : null}
                    </td>
                    <td>{statusBadge(row.status)}</td>
                    <td className="text-end">
                      <div className="d-flex flex-wrap justify-content-end gap-2">
                        {row.status === 'REQUESTED' ? <Button size="sm" variant="outline-success" onClick={() => openAction('first-approve', row)}>Duyệt bước đầu</Button> : null}
                        {['REQUESTED', 'FIRST_APPROVED'].includes(row.status) ? <Button size="sm" variant="outline-danger" onClick={() => openAction('reject', row)}>Từ chối</Button> : null}
                        {row.status === 'CASH_DISBURSED' ? <Button size="sm" variant="success" onClick={() => openAction('final-approve', row)}>Xác nhận hoàn tất</Button> : null}
                        {!['REQUESTED', 'FIRST_APPROVED', 'CASH_DISBURSED'].includes(row.status) ? '—' : null}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        {result.totalPages > 1 ? (
          <Card.Footer className="bg-white d-flex justify-content-between align-items-center">
            <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
            <span className="small text-muted">Trang {page + 1}/{result.totalPages} · {result.totalElements} yêu cầu</span>
            <Button size="sm" variant="outline-secondary" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
          </Card.Footer>
        ) : null}
      </Card>

      <Modal show={Boolean(action)} onHide={closeAction} centered backdrop="static">
        <Modal.Header closeButton={!submitting}><Modal.Title className="h5">{modalTitle}</Modal.Title></Modal.Header>
        <Modal.Body>
          <dl className="row small mb-3">
            <dt className="col-5">Hội viên</dt><dd className="col-7"><code>{action?.row.memberAccountId}</code></dd>
            <dt className="col-5">Số tiền yêu cầu</dt><dd className="col-7">{formatPrice(action?.row.requestedAmount, 'VND')}</dd>
            <dt className="col-5">Mức đề xuất</dt><dd className="col-7">{formatPrice(action?.row.suggestedAmount, 'VND')}</dd>
            {action?.row.approvedAmount != null ? <><dt className="col-5">Đã duyệt</dt><dd className="col-7 fw-bold">{formatPrice(action.row.approvedAmount, 'VND')}</dd></> : null}
          </dl>

          {action?.kind === 'first-approve' ? (
            <Form.Group>
              <Form.Label>Số tiền duyệt *</Form.Label>
              <Form.Control type="number" min="1" step="1" inputMode="numeric" value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} />
              <Form.Text className="text-muted">Không được vượt số tiền hội viên yêu cầu hoặc mức hệ thống đề xuất.</Form.Text>
            </Form.Group>
          ) : null}

          {action?.kind === 'reject' ? (
            <Form.Group>
              <Form.Label>Lý do từ chối *</Form.Label>
              <Form.Control as="textarea" rows={3} maxLength={1000} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
            </Form.Group>
          ) : null}

          {action?.kind === 'final-approve' ? (
            <Alert variant="warning" className="mb-0">
              Chỉ xác nhận sau khi đã kiểm tra bằng chứng giao tiền của Lễ tân. Hệ thống sẽ tạo chứng từ giảm trừ; nếu đây là gói đặt trước, gói sẽ bị hủy.
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={submitting} onClick={closeAction}>Quay lại</Button>
          <Button
            variant={action?.kind === 'reject' ? 'danger' : 'success'}
            disabled={submitting || (action?.kind === 'first-approve' && !approvedAmount.trim()) || (action?.kind === 'reject' && !rejectionReason.trim())}
            onClick={submitAction}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
