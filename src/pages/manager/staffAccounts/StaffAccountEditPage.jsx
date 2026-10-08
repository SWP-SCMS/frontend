// Manager – Edit staff/manager account (US06).
//
// BR-SCP-02 / BR-ACC-05: role is fixed for the account's lifetime — there
// is NO role field on this form. Only fullName / phone / email / birthDate
// are patchable (the backend rejects anything else via JsonAnySetter).
//
// The PATCH semantics are "omitted = unchanged". We therefore send only
// the keys that actually changed vs. the original fetched value.
//
// Migration note (RHF + Zod):
//   - blank phone is intentionally allowed by the schema and the form
//     state. buildPatch() still omits the phone key from the PATCH when
//     blank — preserved exactly as before the migration.
//   - RHF owns input UX + error display. The existing buildPatch()
//     remains the source of truth for the wire payload.
//   - backend EMAIL_ALREADY_EXISTS / PHONE_ALREADY_EXISTS / per-field
//     data.errors are mapped through the shared serverErrors helper.
//   - The status / role are display-only (read-only text), NOT registered
//     inputs — they are not in the schema and never sent.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getStaffAccount,
  updateStaffAccount,
} from '../../../services/staffAccountService';
import { ROLE_LABELS } from '../../../constants';
import {
  formatDate,
  normalizePhone,
} from '../../../utils';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  fullNameSchema,
  emailSchema,
  phoneEditOptionalSchema,
  birthDateSchema,
} from '../../../schemas/fragments';

// Page-local edit schema. phone uses phoneEditOptionalSchema so that
// blank stays blank and never becomes a "required" error.
const staffEditSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneEditOptionalSchema,
  email: emailSchema,
  birthDate: birthDateSchema,
});

function accountToForm(data) {
  return {
    fullName: data?.fullName || '',
    phone: data?.phone || '',
    email: data?.email || '',
    birthDate: data?.birthDate || '',
  };
}

export default function StaffAccountEditPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedNoChange, setSavedNoChange] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(staffEditSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setServerError(null);
    setSavedSuccess(false);
    setSavedNoChange(false);
    try {
      const data = await getStaffAccount(accountId);
      const next = accountToForm(data);
      setAccount(data);
      setOriginal(next);
      reset(next);
    } catch (err) {
      setServerError(err);
    } finally {
      setLoading(false);
    }
  }, [accountId, reset]);

  useEffect(() => {
    load();
  }, [load]);

  function buildPatch(data) {
    // data comes from RHF after a successful Zod parse.
    const patch = {};
    if (data.fullName.trim() !== (original?.fullName || '')) {
      patch.fullName = data.fullName.trim();
    }
    const normalizedNewPhone = data.phone ? normalizePhone(data.phone) : null;
    const normalizedOldPhone = original?.phone
      ? normalizePhone(original.phone)
      : null;
    // blank phone -> OMIT key from PATCH (do not update). This branch
    // is preserved exactly as the pre-migration source had it.
    if (data.phone && normalizedNewPhone !== normalizedOldPhone) {
      patch.phone = normalizedNewPhone;
    }
    if (
      data.email.trim().toLowerCase() !==
      (original?.email || '').toLowerCase()
    ) {
      patch.email = data.email.trim().toLowerCase();
    }
    if (data.birthDate !== (original?.birthDate || '')) {
      patch.birthDate = data.birthDate;
    }
    return patch;
  }

  async function onSubmit(data) {
    setServerError(null);
    setSavedSuccess(false);
    setSavedNoChange(false);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setSavedNoChange(true);
      return;
    }
    try {
      const updated = await updateStaffAccount(accountId, patch);
      const next = accountToForm(updated);
      setAccount(updated);
      setOriginal(next);
      reset(next);
      setSavedSuccess(true);
    } catch (err) {
      // Shared helper: data.errors[field] + EMAIL/PHONE uniqueness.
      // Allowlist MUST match the fields this page renders / registers.
      // role / status / accountId / createdAt are display-only and
      // intentionally NOT in the allowlist — any per-field error for
      // them from a future backend change must NOT be swallowed.
      const handled = applyServerErrors(err, setError, {
        fields: ['fullName', 'phone', 'email', 'birthDate'],
      });
      // Finalization rule: if the shared helper already rendered the
      // failure inline (handled === true), do NOT also raise the global
      // ErrorAlert — the inline message is the only signal.
      if (!handled) {
        setServerError(err);
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (serverError && !account) {
    return (
      <div>
        <Link
          to="/manager/staff-accounts"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={serverError}
          title="Không tải được tài khoản"
        />
      </div>
    );
  }

  if (!account) return null;

  const isInactive = account.status === 'INACTIVE';

  return (
    <div>
      <Link
        to={`/manager/staff-accounts/${account.accountId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">
        Chỉnh sửa tài khoản
      </h1>
      <p className="text-muted mb-4">
        {account.fullName || '—'} · {ROLE_LABELS[account.role] || account.role} ·{' '}
        Account ID <code className="small">{account.accountId}</code>
      </p>

      {isInactive ? (
        <div className="alert alert-warning py-2">
          Tài khoản đang ở trạng thái INACTIVE. Vẫn có thể cập nhật thông tin, nhưng tài
          khoản sẽ không đăng nhập được cho đến khi được tạo mới.
        </div>
      ) : null}

      <ErrorAlert
        error={serverError}
        title="Không lưu được thay đổi"
        onClose={() => setServerError(null)}
      />
      {savedSuccess ? (
        <div className="alert alert-success py-2">Đã lưu thay đổi.</div>
      ) : null}
      {savedNoChange ? (
        <div className="alert alert-warning py-2 mb-3">
          Không có thay đổi để lưu.
        </div>
      ) : null}

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="edit-fullName">
              <Form.Label>Họ và tên *</Form.Label>
              <Form.Control
                {...register('fullName')}
                maxLength={200}
                isInvalid={Boolean(errors.fullName)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.fullName?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-phone">
              <Form.Label>Số điện thoại</Form.Label>
              <Form.Control
                {...register('phone')}
                inputMode="numeric"
                isInvalid={Boolean(errors.phone)}
              />
              <Form.Text className="text-muted">
                Để trống nếu không muốn thay đổi số điện thoại.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.phone?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="edit-email">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                {...register('email')}
                maxLength={320}
                isInvalid={Boolean(errors.email)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.email?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-birthDate">
              <Form.Label>Ngày sinh *</Form.Label>
              <Form.Control
                type="date"
                {...register('birthDate')}
                max={new Date().toISOString().slice(0, 10)}
                isInvalid={Boolean(errors.birthDate)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.birthDate?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <fieldset className="mt-4">
          <legend className="h6 text-uppercase text-muted">Trường không thể chỉnh sửa</legend>
          <Row className="g-3">
            <Col md={6}>
              <div className="text-muted small">Vai trò</div>
              <div className="fw-semibold">
                {ROLE_LABELS[account.role] || account.role || '—'}
              </div>
            </Col>
            <Col md={6}>
              <div className="text-muted small">Trạng thái hiện tại</div>
              <div className="fw-semibold">{account.status || '—'}</div>
            </Col>
          </Row>
          <p className="small text-muted mt-2 mb-0">
            Theo BR-ACC-05 / BR-LIM-02: vai trò cố định suốt vòng đời tài khoản. Để
            thay đổi, chuyển tài khoản sang INACTIVE và tạo tài khoản mới.
          </p>
          <p className="small text-muted mt-1 mb-0">
            Ngày tạo: {formatDate(account.createdAt) || '—'}
          </p>
        </fieldset>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang lưu…
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => {
              if (original) reset(original);
              setServerError(null);
              setSavedSuccess(false);
              setSavedNoChange(false);
            }}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => navigate(`/manager/staff-accounts/${account.accountId}`)}
            disabled={isSubmitting}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}
