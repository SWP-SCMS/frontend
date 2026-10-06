// Receptionist – Member profile at the front desk (US11).
//
// BE: GET   /api/v1/reception/members/{memberId}/profile
//     PATCH /api/v1/reception/members/{memberId}/profile
//     POST  /api/v1/reception/members/{memberId}/reset-password
//
// Contract details that shape this UI:
//   - `memberId` is the public code (^MB-[0-9]+$), never an account UUID.
//   - PATCH is partial: only the keys we send change. The backend rejects
//     unknown/read-only keys (accountId, role, status) with
//     MALFORMED_REQUEST, so we build the body from a whitelist.
//   - fullName/phone/email/birthDate reject explicit null; the optional ones
//     accept null to clear.
//   - emergencyContactName and emergencyContactPhone must BOTH end up
//     non-null or both null — we enforce the pairing in the submit handler
//     rather than letting the backend 400.
//   - Reset password returns 204 with no body and never reveals a password.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getReceptionMemberProfile,
  getReceptionMemberReceipts,
  resetReceptionMemberPassword,
  updateReceptionMemberProfile,
} from '../../../services/receptionistService';
import { ACCOUNT_STATUS } from '../../../constants';
import { formatDateTime, formatPrice, isValidPhone, normalizePhone } from '../../../utils';
import { paymentMethodLabel } from '../../../utils/receiptPdf';
import '../payments/ReceiptPage.css';

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
};

const EDITABLE_FIELDS = [
  'fullName',
  'phone',
  'email',
  'birthDate',
  'fitnessGoal',
  'emergencyContactName',
  'emergencyContactPhone',
];

// The us11 contract rejects an explicit null for these four, so they can
// never be cleared — only the fields below accept null to wipe the value.
const NULLABLE_FIELDS = new Set([
  'fitnessGoal',
  'emergencyContactName',
  'emergencyContactPhone',
]);

// Pragmatic email shape check. The backend does the authoritative
// validation; this only avoids a pointless round-trip on obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);

  // Receipt history (US26 `GET /reception/members/{memberId}/receipts`).
  // Loaded lazily on first expand: most visits to this page are to read or
  // edit the profile, and the receipt list is only needed when a member asks
  // for a copy of a past payment. A failure here is non-fatal — the profile
  // above stays fully usable.
  const [receipts, setReceipts] = useState(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReceptionMemberProfile(memberId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm(toFormState(data));
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
  }, [memberId]);

  function handleChange(field) {
    return (e) => {
      const { value } = e.target;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function startEdit() {
    setForm(toFormState(profile));
    setFormError(null);
    setNotice(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFormError(null);
    setForm(toFormState(profile));
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError(null);

    // The backend rejects an EXPLICIT null for fullName, phone, email and
    // birthDate — so these four can never be cleared, and we must fail on the
    // client instead of silently dropping the key from the patch body.
    if (!form.fullName.trim()) {
      setFormError(new Error('Họ tên không được để trống.'));
      return;
    }
    if (!form.phone.trim()) {
      setFormError(new Error('Số điện thoại không được để trống.'));
      return;
    }
    if (!isValidPhone(form.phone)) {
      setFormError(new Error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'));
      return;
    }
    if (!form.email.trim()) {
      setFormError(new Error('Email không được để trống.'));
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setFormError(new Error('Email không đúng định dạng.'));
      return;
    }
    if (!form.birthDate) {
      setFormError(new Error('Ngày sinh không được để trống.'));
      return;
    }
    if (form.birthDate > todayISO()) {
      setFormError(new Error('Ngày sinh không được nằm trong tương lai.'));
      return;
    }

    const emName = form.emergencyContactName.trim();
    const emPhone = form.emergencyContactPhone.trim();
    if ((emName === '') !== (emPhone === '')) {
      setFormError(
        new Error('Người liên hệ khẩn cấp phải có cả tên và số điện thoại, hoặc để trống cả hai.'),
      );
      return;
    }
    if (emPhone !== '' && !isValidPhone(emPhone)) {
      setFormError(new Error('Số điện thoại khẩn cấp không hợp lệ.'));
      return;
    }

    // Build the body from a whitelist and only send what actually changed,
    // because PATCH semantics are presence-based: an omitted key is left
    // alone, while an explicit null clears the value (optional fields only).
    const patch = {};
    for (const field of EDITABLE_FIELDS) {
      if (!(field in form)) continue;
      const next = form[field].trim();
      const current = profile[field];
      if (field === 'phone' || field === 'emergencyContactPhone') {
        const normalized = next === '' ? null : normalizePhone(next);
        const currentNorm = current ? normalizePhone(current) : null;
        if (normalized !== currentNorm) patch[field] = normalized;
      } else if (next !== (current ?? '').trim()) {
        if (next === '') {
          // Clearing is only legal for the nullable optional fields.
          patch[field] = NULLABLE_FIELDS.has(field) ? null : undefined;
          if (patch[field] === undefined) delete patch[field];
        } else {
          patch[field] = next;
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      setFormError(new Error('Không có thay đổi nào để lưu.'));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateReceptionMemberProfile(memberId, patch);
      setProfile(updated);
      setForm(toFormState(updated));
      setEditing(false);
      setNotice('Đã cập nhật hồ sơ hội viên.');
    } catch (err) {
      setFormError(err);
      // 409 means the email or phone is already taken by another current
      // account. Surface which field so the receptionist can fix it directly.
      const code = err?.response?.data?.code;
      if (code === 'EMAIL_ALREADY_EXISTS' || code === 'PHONE_ALREADY_EXISTS') {
        setNotice(
          code === 'EMAIL_ALREADY_EXISTS'
            ? 'Email này đã được một tài khoản khác sử dụng. Vui lòng nhập email khác.'
            : 'Số điện thoại này đã được một tài khoản khác sử dụng. Vui lòng nhập số khác.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    setResetting(true);
    setResetError(null);
    try {
      await resetReceptionMemberPassword(memberId);
      setShowReset(false);
      setNotice(
        'Đã đặt lại mật khẩu. Mật khẩu mới được sinh từ số điện thoại và không hiển thị trên hệ thống.',
      );
    } catch (err) {
      setResetError(err);
    } finally {
      setResetting(false);
    }
  }

  // Fetched on demand, and only once — `receipts` is the "already loaded"
  // marker, so re-expanding the card does not refetch. A member who has never
  // paid gets an empty array, which renders as an explicit "no receipts yet"
  // rather than a silent blank.
  async function handleLoadReceipts() {
    if (receipts || receiptsLoading) return;
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      setReceipts(await getReceptionMemberReceipts(memberId));
    } catch (err) {
      setReceiptsError(err);
    } finally {
      setReceiptsLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div>
        <ErrorAlert error={error} title="Không tải được hồ sơ hội viên" />
        <Button variant="outline-secondary" onClick={() => navigate('/reception/members')}>
          ← Quay lại tra cứu
        </Button>
      </div>
    );
  }

  if (!profile || !form) return null;

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1">{profile.fullName || 'Hội viên'}</h1>
          <div className="text-muted small">
            Mã hội viên: <span className="fw-semibold">{profile.memberId}</span>
            <span className={`badge ms-2 ${STATUS_BADGE[profile.status] || 'bg-light text-dark'}`}>
              {profile.status || '—'}
            </span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setShowReset(true)}
            disabled={editing}
          >
            Đặt lại mật khẩu
          </Button>
          <Button as={Link} to={`/reception/orders/new?memberId=${profile.memberId}`} variant="outline-danger" size="sm">
            Tạo đơn gói tập
          </Button>
          {/* US20 – cash at the counter. Kept next to the bank-transfer
              entry point so staff pick the right one without hunting. */}
          <Button
            as={Link}
            to={`/reception/payments/cash?memberId=${profile.memberId}`}
            variant="danger"
            size="sm"
            disabled={profile.status !== ACCOUNT_STATUS.ACTIVE}
            title={
              profile.status === ACCOUNT_STATUS.ACTIVE
                ? 'Thu tiền mặt tại quầy'
                : 'Chỉ thu tiền với tài khoản đang hoạt động'
            }
          >
            Thu tiền mặt
          </Button>
        </div>
      </header>

      {notice ? (
        <Alert variant="success" dismissible onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      <ErrorAlert error={formError} title="Không lưu được hồ sơ" onClose={() => setFormError(null)} />

      {profile.status === ACCOUNT_STATUS.SUSPENDED ? (
        <Alert variant="warning">
          Tài khoản đang bị tạm khoá nên không thể tạo đơn gói tập mới. Hãy liên hệ
          quản lý nếu cần gia hạn.
        </Alert>
      ) : null}

      <Form onSubmit={handleSave}>
        <Row className="g-3">
          <Col lg={7}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h2 className="h6 fw-bold mb-0">Thông tin hội viên</h2>
                  {editing ? null : (
                    <Button variant="outline-danger" size="sm" onClick={startEdit}>
                      Chỉnh sửa
                    </Button>
                  )}
                </div>

                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted mb-1">Họ và tên</Form.Label>
                  <Form.Control
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                    disabled={!editing}
                    maxLength={200}
                    required
                  />
                </Form.Group>

                <Row className="g-3">
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Số điện thoại</Form.Label>
                      <Form.Control
                        value={form.phone}
                        onChange={handleChange('phone')}
                        disabled={!editing}
                        inputMode="numeric"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={form.email}
                        onChange={handleChange('email')}
                        disabled={!editing}
                        maxLength={320}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ngày sinh</Form.Label>
                      <Form.Control
                        type="date"
                        value={form.birthDate || ''}
                        onChange={handleChange('birthDate')}
                        disabled={!editing}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Mục tiêu tập luyện</Form.Label>
                      <Form.Control
                        value={form.fitnessGoal || ''}
                        onChange={handleChange('fitnessGoal')}
                        disabled={!editing}
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Người liên hệ khẩn cấp</Form.Label>
                      <Form.Control
                        value={form.emergencyContactName || ''}
                        onChange={handleChange('emergencyContactName')}
                        disabled={!editing}
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">SĐT khẩn cấp</Form.Label>
                      <Form.Control
                        value={form.emergencyContactPhone || ''}
                        onChange={handleChange('emergencyContactPhone')}
                        disabled={!editing}
                        inputMode="numeric"
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {editing ? (
                  <>
                    <div className="d-flex gap-2">
                      <Button type="submit" variant="danger" disabled={saving}>
                        {saving ? <Spinner animation="border" size="sm" /> : 'Lưu thay đổi'}
                      </Button>
                      <Button type="button" variant="outline-secondary" onClick={cancelEdit}>
                        Huỷ
                      </Button>
                    </div>
                    <p className="text-muted small mb-0 mt-3">
                      Họ tên, số điện thoại, email và ngày sinh không thể để trống.
                      Mục tiêu tập luyện và thông tin liên hệ khẩn cấp có thể xoá bằng
                      cách xoá nội dung — nhưng tên và số điện thoại khẩn cấp phải
                      được điền cùng nhau hoặc xoá cả hai.
                    </p>
                  </>
                ) : null}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Card className="border-0 shadow-sm mb-3">
              <Card.Body>
                <h2 className="h6 fw-bold mb-3">Thông tin tài khoản</h2>
                <dl className="row mb-0 small">
                  <dt className="col-5 text-muted fw-normal">Mã hội viên</dt>
                  <dd className="col-7">{profile.memberId}</dd>
                  <dt className="col-5 text-muted fw-normal">Vai trò</dt>
                  <dd className="col-7">{profile.role}</dd>
                  <dt className="col-5 text-muted fw-normal">Trạng thái</dt>
                  <dd className="col-7">{profile.status}</dd>
                  <dt className="col-5 text-muted fw-normal">Ảnh đại diện</dt>
                  <dd className="col-7 text-break">{profile.profileImageUrl || '—'}</dd>
                </dl>
              </Card.Body>
            </Card>

            <Card className="border-0 shadow-sm mb-3">
              <Card.Body>
                <h2 className="h6 fw-bold mb-3">Lịch sử biên lai</h2>

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
                  <p className="text-muted small mb-0">
                    Hội viên chưa có biên lai nào.
                  </p>
                ) : null}

                {receipts && receipts.length > 0 ? (
                  <ul className="list-unstyled small mb-0">
                    {receipts.map((receipt) => (
                      <li
                        key={receipt.receiptId}
                        className="py-2 border-bottom"
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="fw-semibold">
                              {receipt.offerName || 'Gói tập'}
                            </div>
                            <div>{formatPrice(receipt.amount, receipt.currency)}</div>
                            <div className="text-muted">
                              {paymentMethodLabel(receipt.paymentMethod)} ·{' '}
                              {formatDateTime(receipt.issuedAt)}
                            </div>
                          </div>
                          <Button
                            as={Link}
                            to={`/receipts/${receipt.receiptId}`}
                            variant="outline-danger"
                            size="sm"
                          >
                            Xem &amp; in
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card.Body>
            </Card>

            <Alert variant="light" className="border small text-muted mb-0">
              Vai trò và trạng thái tài khoản do quản lý quyết định, không sửa được tại
              quầy. Trường hợp trùng email hoặc số điện thoại với tài khoản khác sẽ
              bị hệ thống từ chối.
            </Alert>
          </Col>
        </Row>
      </Form>

      <Modal show={showReset} onHide={() => setShowReset(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">Đặt lại mật khẩu hội viên</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Mật khẩu của <strong>{profile.fullName}</strong> ({profile.memberId}) sẽ được
            đặt lại. Mật khẩu mới được hệ thống sinh tự động và không hiển thị trên
            màn hình — hãy thông báo cho hội viên theo quy định của trung tâm.
          </p>
          {resetError ? (
            <ErrorAlert error={resetError} title="Không đặt lại được mật khẩu" />
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowReset(false)} disabled={resetting}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={handleResetPassword} disabled={resetting}>
            {resetting ? <Spinner animation="border" size="sm" /> : 'Đặt lại mật khẩu'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function toFormState(profile) {
  if (!profile) return null;
  const next = {};
  for (const field of EDITABLE_FIELDS) {
    next[field] = profile[field] ?? '';
  }
  return next;
}
