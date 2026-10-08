// Manager – Edit Member account (US06).
//
// BR-ACC-05: role is fixed for the account's lifetime — there is NO role
// field on this form. Only fullName / phone / email / birthDate are
// patchable (the backend rejects anything else via JsonAnySetter).
// Status changes (ACTIVE <-> SUSPENDED) happen on the detail page, not
// here.
//
// PATCH semantics are "omitted = unchanged". We therefore send only the
// keys that actually changed vs. the original fetched value.
//
// Migration note (RHF + Zod):
//   - Same migration pattern as StaffAccountEditPage. See that file
//     for the contract explanation; the schemas and buildPatch() logic
//     are byte-faithful copies of the pre-migration source.
//   - blank phone is allowed by the schema and the form state;
//     buildPatch() omits the phone key from PATCH when blank.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getMemberAccount,
  updateMemberAccount,
} from '../../../services/memberAccountService';
import { ROLE_LABELS, ROLES } from '../../../constants';
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

const memberEditSchema = z.object({
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

export default function MemberAccountEditPage() {
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
    resolver: zodResolver(memberEditSchema),
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
      const data = await getMemberAccount(accountId);
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
    const patch = {};
    if (data.fullName.trim() !== (original?.fullName || '')) {
      patch.fullName = data.fullName.trim();
    }
    const normalizedNewPhone = data.phone ? normalizePhone(data.phone) : null;
    const normalizedOldPhone = original?.phone
      ? normalizePhone(original.phone)
      : null;
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
      const updated = await updateMemberAccount(accountId, patch);
      const next = accountToForm(updated);
      setAccount(updated);
      setOriginal(next);
      reset(next);
      setSavedSuccess(true);
    } catch (err) {
      // Shared helper: data.errors[field] + EMAIL/PHONE uniqueness.
      // Allowlist MUST match the fields this page renders / registers.
      // role / status / accountId / createdAt are display-only and
      // intentionally NOT in the allowlist.
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
        <Link to="/manager/members" className="small text-decoration-none">
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={serverError}
          title="Không tải được hội viên"
        />
      </div>
    );
  }

  if (!account) return null;

  return (
    <div>
      <Link
        to={`/manager/members/${account.accountId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa hội viên</h1>
      <p className="text-muted mb-4">
        {account.fullName || '—'} · {ROLE_LABELS[ROLES.MEMBER]} · Account ID{' '}
        <code className="small">{account.accountId}</code>
      </p>

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
          <legend className="h6 text-uppercase text-muted">
            Trường không thể chỉnh sửa
          </legend>
          <Row className="g-3">
            <Col md={6}>
              <div className="text-muted small">Vai trò</div>
              <div className="fw-semibold">{ROLE_LABELS[ROLES.MEMBER]}</div>
            </Col>
            <Col md={6}>
              <div className="text-muted small">Trạng thái hiện tại</div>
              <div className="fw-semibold">{account.status || '—'}</div>
            </Col>
          </Row>
          <p className="small text-muted mt-2 mb-0">
            Theo BR-ACC-05 / BR-LIM-02: vai trò cố định suốt vòng đời tài khoản. Để
            thay đổi trạng thái (ACTIVE ↔ SUSPENDED), dùng nút trên trang chi tiết.
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
            onClick={() => navigate(`/manager/members/${account.accountId}`)}
            disabled={isSubmitting}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}
