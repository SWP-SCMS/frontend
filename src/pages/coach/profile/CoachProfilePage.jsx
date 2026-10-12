// Hồ sơ cá nhân của Huấn luyện viên.
//
// BE chưa có API hồ sơ cho Coach, nên chỉ hiện họ tên, vai trò, mã tài khoản
// (lấy từ useAuth) và form đổi mật khẩu (POST /auth/change-password).
// BR-ACC-24: đổi mật khẩu cần đúng mật khẩu hiện tại. Thành công thì BE hủy
// phiên đăng nhập, FE xóa trạng thái và chuyển về /login.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { changePasswordRequest } from '../../../services/authService';
import { useAuth } from '../../../context/useAuth';
import { passwordSchema } from '../../../schemas/fragments';
import { ROLE_LABELS } from '../../../constants';
import '../schedule/CoachSchedulePage.css';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: passwordSchema, // BR-VAL-ACC-05: mật khẩu >= 8 ký tự
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

export default function CoachProfilePage() {
  const { user, role, terminateSession } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      await changePasswordRequest({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      await terminateSession();
      navigate('/login?changed=1', { replace: true });
    } catch (err) {
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
      setServerError(err);
    }
  }

  return (
    <div className="scms-coach-page">
      <h1 className="h3 fw-bold mb-4">Hồ sơ cá nhân</h1>

      <div className="scms-coach-card p-4 mb-4">
        <h2 className="h5 mb-3">Thông tin tài khoản</h2>
        <dl className="row mb-0">
          <dt className="col-sm-3">Họ và tên</dt>
          <dd className="col-sm-9">{user?.fullName || '—'}</dd>
          <dt className="col-sm-3">Vai trò</dt>
          <dd className="col-sm-9">{ROLE_LABELS[role] || '—'}</dd>
          <dt className="col-sm-3">Mã tài khoản</dt>
          <dd className="col-sm-9">{user?.accountId || '—'}</dd>
        </dl>
      </div>

      <div className="scms-coach-card p-4" style={{ maxWidth: 560 }}>
        <h2 className="h5 mb-1">Đổi mật khẩu</h2>
        <p className="text-muted small">
          Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.
        </p>

        <ErrorAlert
          error={serverError}
          title="Không đổi được mật khẩu"
          onClose={() => setServerError(null)}
        />

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="coach-cp-current">
            <Form.Label>Mật khẩu hiện tại</Form.Label>
            <Form.Control
              type={showPw ? 'text' : 'password'}
              {...register('currentPassword')}
              autoComplete="current-password"
              isInvalid={Boolean(errors.currentPassword)}
            />
            <Form.Control.Feedback type="invalid">
              {errors.currentPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="coach-cp-new">
            <Form.Label>Mật khẩu mới</Form.Label>
            <Form.Control
              type={showPw ? 'text' : 'password'}
              {...register('newPassword')}
              autoComplete="new-password"
              isInvalid={Boolean(errors.newPassword)}
            />
            <Form.Control.Feedback type="invalid">
              {errors.newPassword?.message}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">Tối thiểu 8 ký tự.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="coach-cp-confirm">
            <Form.Label>Xác nhận mật khẩu mới</Form.Label>
            <Form.Control
              type={showPw ? 'text' : 'password'}
              {...register('confirmPassword')}
              autoComplete="new-password"
              isInvalid={Boolean(errors.confirmPassword)}
            />
            <Form.Control.Feedback type="invalid">
              {errors.confirmPassword?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Check
            type="checkbox"
            id="coach-cp-show"
            label="Hiện mật khẩu"
            className="mb-3"
            checked={showPw}
            onChange={(e) => setShowPw(e.target.checked)}
          />

          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
          </Button>
        </Form>
      </div>
    </div>
  );
}
