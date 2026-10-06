// Manager – Staff/Manager account detail (US06).
//
// Read-only view of a single account. Provides Edit + Reset Password +
// Deactivate actions. Deactivation honours BR-ACC-19 / BR-ACC-20
// (must remain at least one ACTIVE MANAGER) — the backend enforces this
// and surfaces a 4xx with a clear message.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  changeStaffAccountStatus,
  getStaffAccount,
  resetStaffAccountPassword,
} from '../../../services/staffAccountService';
import { ROLE_LABELS } from '../../../constants';
import { formatDate } from '../../../utils';

export default function StaffAccountDetailPage() {
  const { accountId } = useParams();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showDeactivate, setShowDeactivate] = useState(false);
  const [reason, setReason] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState(null);

  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);
  const [resetError, setResetError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaffAccount(accountId);
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

  async function handleDeactivate() {
    setDeactivateError(null);
    setDeactivating(true);
    try {
      const next = await changeStaffAccountStatus(accountId, {
        status: 'INACTIVE',
        reason: reason.trim(),
      });
      setAccount(next);
      setShowDeactivate(false);
      setReason('');
    } catch (err) {
      // The backend enforces a few BR-ACC-19 / BR-ACC-20 conflict guards
      // and surfaces 409 STAFF_STATUS_CONFLICT with English detail. We
      // re-map the known cases to a Vietnamese message so the manager
      // understands the reason without digging into logs.
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const serverMessage =
        err?.response?.data?.detail || err?.response?.data?.message;
      if (status === 409 && code === 'STAFF_STATUS_CONFLICT') {
        let friendly;
        if (/last active/i.test(serverMessage || '')) {
          friendly =
            'Không thể vô hiệu hoá Manager cuối cùng còn ACTIVE. Hãy kích hoạt một Manager khác trước.';
        } else if (/already INACTIVE/i.test(serverMessage || '')) {
          friendly = 'Tài khoản này đã ở trạng thái INACTIVE.';
        } else if (/their own account/i.test(serverMessage || '')) {
          friendly = 'Bạn không thể tự vô hiệu hoá tài khoản của chính mình.';
        } else if (/outstanding/i.test(serverMessage || '')) {
          friendly =
            'Coach còn lịch dạy hoặc phân công cá nhân đang hoạt động. Hãy xử lý trước khi vô hiệu hoá.';
        }
        if (friendly) {
          // Preserve the axios error shape so ErrorAlert / extractErrorMessage
          // still works, but override the user-visible message.
          const wrapped = new Error(friendly);
          wrapped.response = {
            ...(err.response || {}),
            data: { ...(err.response?.data || {}), message: friendly },
          };
          setDeactivateError(wrapped);
          return;
        }
      }
      setDeactivateError(err);
    } finally {
      setDeactivating(false);
    }
  }

  async function handleResetPassword() {
    setResetError(null);
    setResetMessage(null);
    setResetting(true);
    try {
      await resetStaffAccountPassword(accountId);
      setResetMessage(
        'Đã đặt lại mật khẩu theo số điện thoại đăng ký hiện tại của tài khoản.',
      );
    } catch (err) {
      setResetError(err);
    } finally {
      setResetting(false);
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
        <Link to="/manager/staff-accounts" className="small text-decoration-none">
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được tài khoản"
        />
      </div>
    );
  }

  if (!account) return null;

  const isInactive = account.status === 'INACTIVE';

  // Prevent opening the deactivate modal if the account is already INACTIVE.
  // Backend's StaffStatusService throws 409 STAFF_STATUS_CONFLICT
  // ("Staff account is already INACTIVE") in this case — we guard here so
  // the manager doesn't see a confusing error for an idempotent request.
  function openDeactivateModal() {
    if (isInactive) {
      const guardErr = new Error(
        'Tài khoản này đã ở trạng thái INACTIVE nên không thể thực hiện lại.',
      );
      guardErr.response = {
        status: 409,
        data: { code: 'STAFF_STATUS_CONFLICT', message: guardErr.message },
      };
      setDeactivateError(guardErr);
      return;
    }
    setDeactivateError(null);
    setShowDeactivate(true);
  }

  return (
    <div>
      <Link to="/manager/staff-accounts" className="small text-decoration-none">
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{account.fullName || '—'}</h1>
          <p className="text-muted mb-0">
            {ROLE_LABELS[account.role] || account.role || '—'}
            {account.status ? ` · ${account.status}` : ''}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/staff-accounts/${account.accountId}/edit`}
            variant="outline-danger"
            disabled={isInactive}
          >
            Chỉnh sửa
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={openDeactivateModal}
            disabled={isInactive}
          >
            Chuyển sang INACTIVE
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
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
                <dd className="col-sm-8 mb-2">
                  {ROLE_LABELS[account.role] || account.role || '—'}
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Trạng thái</dt>
                <dd className="col-sm-8 mb-2">{account.status || '—'}</dd>

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

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Đặt lại mật khẩu</h2>
          <p className="text-muted small mb-3">
            Theo BR-ACC-23: mật khẩu sẽ được đặt lại về số điện thoại đăng ký hiện tại
            của tài khoản. Thao tác này không bắt buộc người dùng phải đổi mật khẩu ở
            lần đăng nhập tiếp theo.
          </p>

          <ErrorAlert
            error={resetError}
            title="Không đặt lại được mật khẩu"
            onClose={() => setResetError(null)}
          />
          {resetMessage ? (
            <div className="alert alert-success py-2 mb-3">{resetMessage}</div>
          ) : null}

          <Button
            type="button"
            variant="outline-danger"
            onClick={handleResetPassword}
            disabled={resetting || isInactive}
          >
            {resetting ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
          </Button>
        </Card.Body>
      </Card>

      <Modal show={showDeactivate} onHide={() => setShowDeactivate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Chuyển tài khoản sang INACTIVE</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Theo BR-ACC-19, đây là trạng thái kết thúc làm việc của tài khoản. Tài khoản
            INACTIVE không thể đăng nhập nhưng lịch sử nghiệp vụ trước đó vẫn được bảo toàn.
            Hành động này sẽ tạo Audit event (BR-ACC-25).
          </p>
          <ErrorAlert
            error={deactivateError}
            title="Không thực hiện được"
            onClose={() => setDeactivateError(null)}
          />
          <Form.Group controlId="deactivate-reason">
            <Form.Label>Lý do</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: nhân viên nghỉ việc từ 30/10/2026"
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
            onClick={() => setShowDeactivate(false)}
            disabled={deactivating}
          >
            Huỷ
          </Button>
          <Button
            variant="danger"
            onClick={handleDeactivate}
            disabled={!reason.trim() || deactivating}
          >
            {deactivating ? 'Đang xử lý…' : 'Xác nhận'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}