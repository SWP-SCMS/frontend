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
//
// Migration note (RHF + Zod) — Wave 3:
//   - Only the INLINE profile-edit form is migrated. Everything else on
//     this page (reset-password modal, receipts, account-info display,
//     status banner, navigation) is intentionally OUT OF RHF.
//   - profileImageUrl is NOT in F06's editable allowlist (it is read-only
//     on this page). The F04 page-local http(s) URL regex is NOT applied
//     here — F06 has no such rule and the pre-migration source did not
//     validate the URL.
//   - RHF owns the 7 inline editable fields. `profile` keeps the full
//     loaded entity for display, action buttons, and buildPatch diffs.
//   - The 4 non-nullable fields (fullName, phone, email, birthDate) are
//     required at the Zod level. The 3 nullable fields (fitnessGoal,
//     emergencyContactName, emergencyContactPhone) use the
//     NULLABLE_FIELDS allowlist at the wire level.
//   - `editing` toggle mode is preserved; cancelEdit() restores form
//     from `profile` via reset(profileToEditableForm(profile)).
//   - buildPatch() preserves the pre-migration diff + null-clearing
//     semantics byte-for-byte.

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
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getReceptionMemberProfile,
  getReceptionMemberReceipts,
  resetReceptionMemberPassword,
  updateReceptionMemberProfile,
} from '../../../services/receptionistService';
import { ACCOUNT_STATUS } from '../../../constants';
import { formatDateTime, formatPrice, normalizePhone } from '../../../utils';
import { applyServerErrors } from '../../../utils/serverErrors';
import { emailSchema, birthDateSchema } from '../../../schemas/fragments';
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

// Page-local schema for the inline edit form. The 4 non-nullable fields
// are required (Zod min(1) after trim). The 3 nullable fields accept an
// empty string. The emergencyContact pairing rule lives in a superRefine
// because it is a cross-field invariant.
const phoneRequiredSchema = z
  .string()
  .trim()
  .min(1, 'Số điện thoại không được để trống.')
  .refine(
    (s) => normalizePhone(s) != null,
    'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.',
  )
  .transform((s) => normalizePhone(s));

const receptionMemberProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Họ tên không được để trống.'),
    phone: phoneRequiredSchema,
    email: emailSchema,
    birthDate: birthDateSchema,
    fitnessGoal: z.string(),
    emergencyContactName: z.string(),
    emergencyContactPhone: z.string(),
  })
  .superRefine((d, ctx) => {
    const emName = (d.emergencyContactName || '').trim();
    const emPhone = (d.emergencyContactPhone || '').trim();
    if ((emName === '') !== (emPhone === '')) {
      ctx.addIssue({
        path: ['emergencyContactPhone'],
        code: 'custom',
        message:
          'Người liên hệ khẩn cấp phải có cả tên và số điện thoại, hoặc để trống cả hai.',
      });
    } else if (emPhone !== '' && normalizePhone(emPhone) == null) {
      ctx.addIssue({
        path: ['emergencyContactPhone'],
        code: 'custom',
        message: 'Số điện thoại khẩn cấp không hợp lệ.',
      });
    }
  });

// Initial RHF defaults for the inline edit form. The schema validation
// runs on the RHF-owned form, not on `profile`.
const EDIT_FORM_DEFAULTS = {
  fullName: '',
  phone: '',
  email: '',
  birthDate: '',
  fitnessGoal: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

function profileToEditableForm(profile) {
  if (!profile) return null;
  const next = {};
  for (const field of EDITABLE_FIELDS) {
    next[field] = profile[field] ?? '';
  }
  return next;
}

export default function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();

  // ----- Non-form page state (intentionally OUT of RHF) -----
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Reset-password modal state.
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(null);

  // Receipt history (US26). Lazy on first expand.
  const [receipts, setReceipts] = useState(null);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);

  // ----- RHF: inline profile-edit form -----
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formLevelError, setFormLevelError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(receptionMemberProfileSchema),
    defaultValues: EDIT_FORM_DEFAULTS,
  });

  // Reset RHF state from the freshly loaded profile whenever the page
  // loads a new member, OR the user starts editing. The form is only
  // meaningful in `editing` mode; outside of edit mode the form values
  // are not shown.
  function hydrateFormFromProfile() {
    const next = profileToEditableForm(profile);
    if (next) reset(next);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getReceptionMemberProfile(memberId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        reset(profileToEditableForm(data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberId, reset]);

  function startEdit() {
    hydrateFormFromProfile();
    setFormLevelError(null);
    setNotice(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setFormLevelError(null);
    hydrateFormFromProfile();
  }

  // buildPatch(data) — diff against `profile`. Preserved byte-for-byte
  // from the pre-migration source:
  //   - phone / emergencyContactPhone: normalized, blank -> null
  //   - other fields: trim and compare; blank -> null only if in
  //     NULLABLE_FIELDS, otherwise the key is omitted (we never
  //     send "" for non-nullable fields because Zod already blocked
  //     that case at the form level).
  function buildPatch(data) {
    const patch = {};
    for (const field of EDITABLE_FIELDS) {
      if (!(field in data)) continue;
      const next = (data[field] || '').trim();
      const current = profile[field];
      if (field === 'phone' || field === 'emergencyContactPhone') {
        const normalized = next === '' ? null : normalizePhone(next);
        const currentNorm = current ? normalizePhone(current) : null;
        if (normalized !== currentNorm) patch[field] = normalized;
      } else if (next !== (current ?? '').trim()) {
        if (next === '') {
          // Clearing is only legal for the nullable optional fields.
          if (NULLABLE_FIELDS.has(field)) {
            patch[field] = null;
          } else {
            // Non-nullable field with blank value: Zod already blocked
            // this; defensive no-op preserves pre-migration behavior.
            patch[field] = undefined;
            delete patch[field];
          }
        } else {
          patch[field] = next;
        }
      }
    }
    return patch;
  }

  async function onSubmit(data) {
    setFormLevelError(null);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setFormLevelError(new Error('Không có thay đổi nào để lưu.'));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateReceptionMemberProfile(memberId, patch);
      setProfile(updated);
      reset(profileToEditableForm(updated));
      setEditing(false);
      setNotice('Đã cập nhật hồ sơ hội viên.');
    } catch (err) {
      // Shared helper for per-field errors. Allowlist matches the 7
      // inline editable fields. EMAIL_ALREADY_EXISTS / PHONE_ALREADY_EXISTS
      // map inline when email / phone are allowed (they are).
      // We intentionally do NOT pass profileImageUrl, accountId,
      // memberId, role, status, or any action-only field — those are
      // not part of the RHF inline form.
      const handled = applyServerErrors(err, setError, {
        fields: EDITABLE_FIELDS,
      });

      // 409 page-local operator notice (preserves the pre-migration
      // operator workflow). Runs UNCONDITIONALLY when the code is
      // present, so the receptionist always sees a hint, regardless
      // of whether the shared helper already mapped the failure
      // inline. The shared helper does map these codes when their
      // fields are allowed (email / phone are), so the user sees
      // both the inline field error AND the operator notice — but
      // NOT a duplicate global ErrorAlert (see `!handled` below).
      const code = err?.response?.data?.code;
      if (code === 'EMAIL_ALREADY_EXISTS') {
        setNotice(
          'Email này đã được một tài khoản khác sử dụng. Vui lòng nhập email khác.',
        );
      } else if (code === 'PHONE_ALREADY_EXISTS') {
        setNotice(
          'Số điện thoại này đã được một tài khoản khác sử dụng. Vui lòng nhập số khác.',
        );
      }

      // Global form-level ErrorAlert only when the shared helper did
      // NOT already render the failure inline. EMAIL_ALREADY_EXISTS /
      // PHONE_ALREADY_EXISTS now produce inline (handled === true) +
      // notice + NO global ErrorAlert — preserving the spec exactly.
      if (!handled) {
        setFormLevelError(err);
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

  if (loadError && !profile) {
    return (
      <div>
        <ErrorAlert error={loadError} title="Không tải được hồ sơ hội viên" />
        <Button variant="outline-secondary" onClick={() => navigate('/reception/members')}>
          ← Quay lại tra cứu
        </Button>
      </div>
    );
  }

  if (!profile) return null;

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

      <ErrorAlert error={formLevelError} title="Không lưu được hồ sơ" onClose={() => setFormLevelError(null)} />

      {profile.status === ACCOUNT_STATUS.SUSPENDED ? (
        <Alert variant="warning">
          Tài khoản đang bị tạm khoá nên không thể tạo đơn gói tập mới. Hãy liên hệ
          quản lý nếu cần gia hạn.
        </Alert>
      ) : null}

      {/* ----- INLINE PROFILE EDIT FORM (RHF + Zod) ----- */}
      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
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
                    {...register('fullName')}
                    disabled={!editing}
                    maxLength={200}
                    isInvalid={Boolean(errors.fullName)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.fullName?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Row className="g-3">
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Số điện thoại</Form.Label>
                      <Form.Control
                        {...register('phone')}
                        disabled={!editing}
                        inputMode="numeric"
                        isInvalid={Boolean(errors.phone)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.phone?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Email</Form.Label>
                      <Form.Control
                        type="email"
                        {...register('email')}
                        disabled={!editing}
                        maxLength={320}
                        isInvalid={Boolean(errors.email)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ngày sinh</Form.Label>
                      <Form.Control
                        type="date"
                        {...register('birthDate')}
                        disabled={!editing}
                        isInvalid={Boolean(errors.birthDate)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.birthDate?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Mục tiêu tập luyện</Form.Label>
                      <Form.Control
                        {...register('fitnessGoal')}
                        disabled={!editing}
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Người liên hệ khẩn cấp</Form.Label>
                      <Form.Control
                        {...register('emergencyContactName')}
                        disabled={!editing}
                        placeholder="Không bắt buộc"
                        isInvalid={Boolean(errors.emergencyContactName)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.emergencyContactName?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">SĐT khẩn cấp</Form.Label>
                      <Form.Control
                        {...register('emergencyContactPhone')}
                        disabled={!editing}
                        inputMode="numeric"
                        placeholder="Không bắt buộc"
                        isInvalid={Boolean(errors.emergencyContactPhone)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.emergencyContactPhone?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                {editing ? (
                  <>
                    <div className="d-flex gap-2">
                      <Button
                        type="submit"
                        variant="danger"
                        disabled={isSubmitting || saving}
                      >
                        {saving || isSubmitting ? <Spinner animation="border" size="sm" /> : 'Lưu thay đổi'}
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
