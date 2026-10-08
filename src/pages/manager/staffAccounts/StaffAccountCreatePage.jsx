// Manager – Create staff/manager account (US08).
//
// Business rules (BR-ACC-03, BR-ACC-04, BR-VAL-ACC-03..09):
//   - Manager creates COACH, RECEPTIONIST or MANAGER.
//   - All of fullName / phone / email / birthDate / role are required.
//   - Role is FIXED for the account's lifetime (BR-SCP-02, BR-LIM-02).
//   - Default password = current phone number (set by backend).
//
// Backend enforces 409 on duplicate email/phone and rejects unknown
// fields via StaffAccountCreateRequest#rejectUnknownField. We only send
// the five documented keys.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createStaffAccount } from '../../../services/staffAccountService';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  fullNameSchema,
  emailSchema,
  phoneCreateSchema,
  birthDateSchema,
} from '../../../schemas/fragments';
import { ROLE_LABELS, ROLES } from '../../../constants';

const ROLE_OPTIONS = [
  { value: ROLES.COACH, label: ROLE_LABELS[ROLES.COACH] },
  { value: ROLES.RECEPTIONIST, label: ROLE_LABELS[ROLES.RECEPTIONIST] },
  { value: ROLES.MANAGER, label: ROLE_LABELS[ROLES.MANAGER] },
];

// Page-local schema composes the shared fragments + role enum.
const staffCreateSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneCreateSchema,
  email: emailSchema,
  birthDate: birthDateSchema,
  role: z.enum(
    [ROLES.COACH, ROLES.RECEPTIONIST, ROLES.MANAGER],
    { message: 'Vui lòng chọn vai trò.' },
  ),
});

export default function StaffAccountCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
      role: '',
    },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      // Preserve existing payload normalization:
      //   - fullName trimmed (handled by the schema's .trim())
      //   - phone canonical 10-digit form (handled by phoneCreateSchema's transform)
      //   - email trimmed (schema) and lowercased here (matches the source's
      //     form.email.trim().toLowerCase())
      //   - birthDate as yyyy-MM-dd string
      const created = await createStaffAccount({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email.toLowerCase(),
        birthDate: data.birthDate,
        role: data.role,
      });
      navigate(`/manager/staff-accounts/${created.accountId}`, { replace: true });
    } catch (err) {
      // Shared helper: data.errors + EMAIL/PHONE uniqueness.
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: ['fullName', 'phone', 'email', 'birthDate', 'role'],
      });
      // Finalization rule: if the shared helper already rendered the
      // failure inline (handled === true), do NOT also raise the global
      // ErrorAlert — the inline message is the only signal.
      if (!handled) {
        setServerError(err);
      }
    }
  }

  return (
    <div>
      <Link
        to="/manager/staff-accounts"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo tài khoản nhân viên hoặc quản lý</h1>
      <p className="text-muted mb-4">
        Theo BR-ACC-03: tài khoản mới được tạo ở trạng thái ACTIVE, mật khẩu mặc định là
        số điện thoại đăng ký. Vai trò được gán cố định cho toàn bộ vòng đời tài khoản
        (BR-SCP-02).
      </p>

      <ErrorAlert
        error={serverError}
        title="Không tạo được tài khoản"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="create-fullName">
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
            <Form.Group controlId="create-phone">
              <Form.Label>Số điện thoại *</Form.Label>
              <Form.Control
                {...register('phone')}
                inputMode="numeric"
                placeholder="VD: 0901234567"
                isInvalid={Boolean(errors.phone)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.phone?.message}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Cũng được dùng làm mật khẩu mặc định của tài khoản.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="create-email">
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
            <Form.Group controlId="create-birthDate">
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

        <Form.Group className="mt-3" controlId="create-role">
          <Form.Label>Vai trò *</Form.Label>
          <Form.Select
            {...register('role')}
            isInvalid={Boolean(errors.role)}
          >
            <option value="">— Chọn vai trò —</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">
            {errors.role?.message}
          </Form.Control.Feedback>
          <Form.Text className="text-muted">
            Vai trò sẽ không thể thay đổi. Để đổi vai trò, hãy chuyển tài khoản sang
            INACTIVE và tạo tài khoản mới.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo tài khoản'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/staff-accounts')}
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
