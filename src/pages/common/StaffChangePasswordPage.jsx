import { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../components/common/ErrorAlert';
import { ROLES } from '../../constants';
import { useAuth } from '../../context/useAuth';
import { passwordSchema } from '../../schemas/fragments';
import { changePasswordRequest } from '../../services/authService';

const PROFILE_PATHS = {
  [ROLES.MANAGER]: '/manager/profile',
  [ROLES.RECEPTIONIST]: '/reception/profile',
  [ROLES.COACH]: '/coach/profile',
};

const schema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
}).superRefine((data, context) => {
  if (data.newPassword === data.currentPassword) {
    context.addIssue({ path: ['newPassword'], code: 'custom', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
  }
  if (data.newPassword !== data.confirmPassword) {
    context.addIssue({ path: ['confirmPassword'], code: 'custom', message: 'Mật khẩu xác nhận không khớp.' });
  }
});

export default function StaffChangePasswordPage() {
  const navigate = useNavigate();
  const { role, terminateSession } = useAuth();
  const profilePath = PROFILE_PATHS[role] || '/';
  const [visibleFields, setVisibleFields] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      await changePasswordRequest({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      await terminateSession();
      navigate('/login?changed=1', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'CURRENT_PASSWORD_INCORRECT') {
        setError('currentPassword', { type: 'server', message: 'Mật khẩu hiện tại không đúng.' });
      } else if (code === 'NEW_PASSWORD_SAME_AS_CURRENT') {
        setError('newPassword', { type: 'server', message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
      } else {
        setServerError(err);
      }
    }
  }

  function toggleVisibility(field) {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  }

  function passwordField(field, autoComplete) {
    const visible = visibleFields[field];
    return (
      <InputGroup>
        <Form.Control
          type={visible ? 'text' : 'password'}
          {...register(field)}
          autoComplete={autoComplete}
          isInvalid={Boolean(errors[field])}
        />
        <Button
          type="button"
          variant="outline-secondary"
          onClick={() => toggleVisibility(field)}
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${field === 'currentPassword' ? 'mật khẩu hiện tại' : 'mật khẩu mới'}`}
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </Button>
        <Form.Control.Feedback type="invalid">{errors[field]?.message}</Form.Control.Feedback>
      </InputGroup>
    );
  }

  return (
    <div>
      <Link to={profilePath} className="d-inline-block mb-3">← Quay lại hồ sơ cá nhân</Link>
      <h1 className="h3 fw-bold mb-1">Đổi mật khẩu</h1>
      <p className="text-muted mb-4">Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.</p>
      <Card className="border-0 shadow-sm" style={{ maxWidth: 720 }}>
        <Card.Body className="p-4">
          <ErrorAlert error={serverError} title="Không đổi được mật khẩu" onClose={() => setServerError(null)} />
          <Form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Form.Group className="mb-3" controlId="staff-password-current">
              <Form.Label>Mật khẩu hiện tại *</Form.Label>
              {passwordField('currentPassword', 'current-password')}
            </Form.Group>
            <Form.Group className="mb-3" controlId="staff-password-new">
              <Form.Label>Mật khẩu mới *</Form.Label>
              {passwordField('newPassword', 'new-password')}
              <Form.Text className="text-muted">Tối thiểu 8 ký tự và không quá 72 ký tự.</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3" controlId="staff-password-confirm">
              <Form.Label>Xác nhận mật khẩu mới *</Form.Label>
              {passwordField('confirmPassword', 'new-password')}
            </Form.Group>
            <div className="d-flex gap-2">
              <Button type="submit" variant="danger" disabled={isSubmitting}>{isSubmitting ? 'Đang đổi...' : 'Đổi mật khẩu'}</Button>
              <Button as={Link} to={profilePath} variant="outline-secondary" disabled={isSubmitting}>Hủy</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
