// Member change-password.
//
// Handoff §8.1 "New decision to sync into next BR":
//   - new password must differ from current password
//   - success terminates current session
//   - FE clears auth state and redirects to Login
//
// We send the request, then call `terminateSession()` regardless of the
// server's exact response so the local state matches the rule. The
// backend is expected to return 204 on success and may itself return 4xx
// (CURRENT_PASSWORD_INCORRECT, NEW_PASSWORD_SAME_AS_CURRENT, etc.).
//
// `confirmPassword` is FE-only.
//
// Migration note (RHF + Zod):
//   - Passwords are NOT trimmed and NOT lowercased (byte-faithful wire).
//   - Cross-field rules live in a superRefine on the schema.
//   - Page-local backend error codes:
//       CURRENT_PASSWORD_INCORRECT       -> setError('currentPassword', …)
//       NEW_PASSWORD_SAME_AS_CURRENT     -> setError('newPassword', …)
//     These stay page-local and are NOT promoted into the shared
//     serverErrors helper.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { changePasswordRequest } from '../../../services/authService';
import { useAuth } from '../../../context/useAuth';
import { passwordSchema } from '../../../schemas/fragments';

import './MemberChangePasswordPage.css';

// Page-local schema composes the shared passwordSchema + page-local
// required fields. Cross-field rules are in superRefine so the issue
// path can be assigned precisely.
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
  })
  .superRefine((d, ctx) => {
    if (d.newPassword === d.currentPassword) {
      ctx.addIssue({
        path: ['newPassword'],
        code: 'custom',
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      });
    }
    if (d.newPassword !== d.confirmPassword) {
      ctx.addIssue({
        path: ['confirmPassword'],
        code: 'custom',
        message: 'Mật khẩu xác nhận không khớp.',
      });
    }
  });

export default function MemberChangePasswordPage() {
  const { terminateSession } = useAuth();
  const navigate = useNavigate();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      await changePasswordRequest({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      // Backend terminated the session — clear local auth state and
      // send the user back to login. We do NOT try to keep them logged
      // in here, per BR decision.
      await terminateSession();
      navigate('/login?changed=1', { replace: true });
    } catch (err) {
      // PAGE-LOCAL backend error mapping — these codes are not handled
      // by the shared serverErrors helper (intentionally narrow scope).
      const code = err?.response?.data?.code;
      if (code === 'CURRENT_PASSWORD_INCORRECT') {
        setError('currentPassword', {
          type: 'server',
          message: 'Mật khẩu hiện tại không đúng.',
        });
      } else if (code === 'NEW_PASSWORD_SAME_AS_CURRENT') {
        setError('newPassword', {
          type: 'server',
          message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
        });
      }
      // Unknown / non-field server failures fall through to ErrorAlert.
      setServerError(err);
    }
  }

  return (
    <div className="scms-auth-wrap-wide">
      <h1 className="h3 fw-bold mb-1">Đổi mật khẩu</h1>
      <p className="text-muted mb-4">
        Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.
      </p>

      <ErrorAlert
        error={serverError}
        title="Không đổi được mật khẩu"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Form.Group className="mb-3" controlId="cp-current">
          <Form.Label>Mật khẩu hiện tại</Form.Label>
          <InputGroup>
            <Form.Control
              type={showCurrent ? 'text' : 'password'}
              {...register('currentPassword')}
              autoComplete="current-password"
              isInvalid={Boolean(errors.currentPassword)}
            />
            <Button
              variant="outline-secondary"
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
            >
              {showCurrent ? 'Ẩn' : 'Hiện'}
            </Button>
            <Form.Control.Feedback type="invalid">
              {errors.currentPassword?.message}
            </Form.Control.Feedback>
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="cp-new">
          <Form.Label>Mật khẩu mới</Form.Label>
          <InputGroup>
            <Form.Control
              type={showNew ? 'text' : 'password'}
              {...register('newPassword')}
              autoComplete="new-password"
              isInvalid={Boolean(errors.newPassword)}
            />
            <Button
              variant="outline-secondary"
              type="button"
              onClick={() => setShowNew((s) => !s)}
            >
              {showNew ? 'Ẩn' : 'Hiện'}
            </Button>
            <Form.Control.Feedback type="invalid">
              {errors.newPassword?.message}
            </Form.Control.Feedback>
          </InputGroup>
          <Form.Text className="text-muted">Tối thiểu 8 ký tự.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-4" controlId="cp-confirm">
          <Form.Label>Xác nhận mật khẩu mới</Form.Label>
          <Form.Control
            type="password"
            {...register('confirmPassword')}
            autoComplete="new-password"
            isInvalid={Boolean(errors.confirmPassword)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.confirmPassword?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
          </Button>
          <Button as={Link} to="/member/profile" variant="outline-secondary">
            Quay lại
          </Button>
        </div>
      </Form>
    </div>
  );
}
