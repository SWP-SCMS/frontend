// Manager – Member account detail (US06).
//
// Read-only view of a single Member account. Provides Edit + Suspend /
// Reactivate actions. Status flow for Members: ACTIVE <-> SUSPENDED
// (no INACTIVE — Members aren't deactivated, they're suspended or frozen).
// Suspending a Member cancels all their future bookings (BR-ACC-19).

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  changeMemberAccountStatus,
  getMemberAccount,
} from '../../../services/memberAccountService';
import {
  getReceptionMemberReceipts,
} from '../../../services/receptionistService';
import { ACCOUNT_STATUS, ROLE_LABELS, ROLES } from '../../../constants';
import { formatDate, formatDateTime, formatPrice } from '../../../utils';
import { paymentMethodLabel } from '../../../utils/receiptPdf';
import '../../receptionist/payments/ReceiptPage.css';

const STATUS_LABELS = {
  [ACCOUNT_STATUS.ACTIVE]: 'Đang hoạt động',
  [ACCOUNT_STATUS.SUSPENDED]: 'Tạm khoá',
  [ACCOUNT_STATUS.INACTIVE]: 'Ngưng hoạt động',
};

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
  [ACCOUNT_STATUS.INACTIVE]: 'bg-secondary-subtle text-secondary-emphasis',
};

export default function MemberAccountDetailPage() {
  const { accountId } = useParams();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showStatus, setShowStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Receipt history (US26). The backend widened this endpoint to
  // RECEPTIONIST and MANAGER in commit 63badea, so a manager can use it too.
  // It is keyed by member code, which is `account.memberId` here — not the
  // accountId this route is parametrised by. Loaded on demand only.
  const [receipts, setReceipts] = useState(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMemberAccount(accountId);
      setAccount(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  function openStatusModal(target) {
    setNextStatus(target);
    setReason('');
    setStatusError(null);
    setShowStatus(true);
  }

  // On demand, and only once — `receipts` marks "already fetched". An empty
  // result renders as an explicit message rather than a blank card.
  async function handleLoadReceipts() {
    if (receipts || receiptsLoading) return;
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      setReceipts(await getReceptionMemberReceipts(account.memberId));
    } catch (err) {
      setReceiptsError(err);
    } finally {
      setReceiptsLoading(false);
    }
  }

  async function handleConfirmStatus() {
    setStatusError(null);
    setSubmitting(true);
    try {
      await changeMemberAccountStatus(accountId, {
        status: nextStatus,
        reason: reason.trim(),
      });
      // Reload to get the canonical state from BE.
      await load();
      setShowStatus(false);
      setReason('');
    } catch (err) {
      setStatusError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Link to="/manager/members" className="small text-decoration-none">
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được hội viên"
        />
      </div>
    );
  }

  if (!account) return null;

  const status = account.status;
  const isActive = status === ACCOUNT_STATUS.ACTIVE;
  const isSuspended = status === ACCOUNT_STATUS.SUSPENDED;

  return (
    <div>
      <Link to="/manager/members" className="small text-decoration-none">
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{account.fullName || '—'}</h1>
          <p className="text-muted mb-1">
            {ROLE_LABELS[ROLES.MEMBER]}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/members/${account.accountId}/edit`}
            variant="outline-danger"
          >
            Chỉnh sửa
          </Button>
          {isActive ? (
            <Button
              type="button"
              variant="warning"
              onClick={() => openStatusModal(ACCOUNT_STATUS.SUSPENDED)}
            >
              Tạm khoá
            </Button>
          ) : null}
          {isSuspended ? (
            <Button
              type="button"
              variant="success"
              onClick={() => openStatusModal(ACCOUNT_STATUS.ACTIVE)}
            >
              Kích hoạt lại
            </Button>
          ) : null}
        </div>
      </div>

      <Row className="g-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Thông tin tài khoản</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4 text-muted fw-normal">Account ID</dt>
                <dd className="col-sm-8 text-break mb-2">
                  <code className="small">{account.accountId}</code>
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Vai trò</dt>
                <dd className="col-sm-8 mb-2">{ROLE_LABELS[ROLES.MEMBER]}</dd>

                <dt className="col-sm-4 text-muted fw-normal">Trạng thái</dt>
                <dd className="col-sm-8 mb-2">
                  <span className={`badge ${STATUS_BADGE[status] || 'bg-light text-dark'}`}>
                    {STATUS_LABELS[status] || status || '—'}
                  </span>
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Ngày sinh</dt>
                <dd className="col-sm-8 mb-0">{formatDate(account.birthDate)}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Liên hệ</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4 text-muted fw-normal">Số điện thoại</dt>
                <dd className="col-sm-8 mb-2">{account.phone || '—'}</dd>

                <dt className="col-sm-4 text-muted fw-normal">Email</dt>
                <dd className="col-sm-8 mb-0 text-break">{account.email || '—'}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm mt-3">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Lịch sử biên lai</h2>

          {!receipts ? (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleLoadReceipts}
              disabled={receiptsLoading}
            >
              {receiptsLoading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                'Xem lịch sử biên lai'
              )}
            </Button>
          ) : null}

          {receiptsError ? (
            <ErrorAlert
              error={receiptsError}
              title="Không tải được lịch sử biên lai"
              onClose={() => setReceiptsError(null)}
            />
          ) : null}

          {receipts && receipts.length === 0 ? (
            <p className="text-muted small mb-0">Hội viên chưa có biên lai nào.</p>
          ) : null}

          {receipts && receipts.length > 0 ? (
            <div className="table-responsive">
              <Table size="sm" className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Số biên lai</th>
                    <th>Gói tập</th>
                    <th>Phương thức</th>
                    <th className="text-end">Số tiền</th>
                    <th>Ngày xuất</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.receiptId}>
                      <td>
                        <code className="small">{receipt.receiptNumber}</code>
                      </td>
                      <td>{receipt.offerName || '—'}</td>
                      <td>{paymentMethodLabel(receipt.paymentMethod)}</td>
                      <td className="text-end">
                        {formatPrice(receipt.amount, receipt.currency)}
                      </td>
                      <td>{formatDateTime(receipt.issuedAt)}</td>
                      <td className="text-end">
                        <Button
                          as={Link}
                          to={`/receipts/${receipt.receiptId}`}
                          variant="outline-danger"
                          size="sm"
                        >
                          Xem &amp; in
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <Modal show={showStatus} onHide={() => setShowStatus(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {nextStatus === ACCOUNT_STATUS.SUSPENDED
              ? 'Tạm khoá hội viên'
              : 'Kích hoạt lại hội viên'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            {nextStatus === ACCOUNT_STATUS.SUSPENDED
              ? 'Theo BR-ACC-19: tất cả các buổi tập đã đặt trong tương lai của hội viên sẽ bị huỷ. Thao tác này sẽ tạo Audit event và gửi notification cho hội viên.'
              : 'Hội viên sẽ có thể đăng nhập và đặt lịch tập trở lại. Thao tác này sẽ tạo Audit event và gửi notification.'}
          </p>
          <ErrorAlert
            error={statusError}
            title="Không thực hiện được"
            onClose={() => setStatusError(null)}
          />
          <Form.Group controlId="status-reason">
            <Form.Label>Lý do</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                nextStatus === ACCOUNT_STATUS.SUSPENDED
                  ? 'Ví dụ: vi phạm nội quy trung tâm'
                  : 'Ví dụ: hết thời hạn khoá tài khoản'
              }
              required
            />
            <Form.Text className="text-muted">
              Lý do sẽ được lưu vào Audit log.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowStatus(false)}
            disabled={submitting}
          >
            Huỷ
          </Button>
          <Button
            variant={nextStatus === ACCOUNT_STATUS.SUSPENDED ? 'warning' : 'success'}
            onClick={handleConfirmStatus}
            disabled={!reason.trim() || submitting}
          >
            {submitting ? 'Đang xử lý…' : 'Xác nhận'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}