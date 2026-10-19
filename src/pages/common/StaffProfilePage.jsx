import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../components/common/ErrorAlert';
import { ROLE_LABELS } from '../../constants';
import { useAuth } from '../../context/useAuth';
import {
  birthDateSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
  phoneCreateSchema,
} from '../../schemas/fragments';
import { changePasswordRequest } from '../../services/authService';
import {
  getMyStaffProfile,
  updateMyStaffProfile,
} from '../../services/staffProfileService';
import { normalizePhone } from '../../utils';
import { getGymZoneTodayIsoDate } from '../../utils/gymTime';
import { applyServerErrors } from '../../utils/serverErrors';

const STATUS_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngưng hoạt động',
};

const profileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneCreateSchema,
  email: emailSchema,
  birthDate: birthDateSchema,
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
  })
  .superRefine((data, context) => {
    if (data.newPassword === data.currentPassword) {
      context.addIssue({
        path: ['newPassword'],
        code: 'custom',
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        path: ['confirmPassword'],
        code: 'custom',
        message: 'Mật khẩu xác nhận không khớp.',
      });
    }
  });

function profileToForm(profile) {
  return {
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    birthDate: profile?.birthDate || '',
  };
}

export default function StaffProfilePage() {
  const navigate = useNavigate();
  const { setUser, terminateSession } = useAuth();
  const [profile, setProfile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: profileToForm(null),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    setError: setPasswordError,
    formState: { errors: passwordErrors, isSubmitting: passwordSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [passwordServerError, setPasswordServerError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMyStaffProfile();
      const form = profileToForm(data);
      setProfile(data);
      setOriginal(form);
      reset(form);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    load();
  }, [load]);

  function buildPatch(data) {
    const patch = {};
    if (data.fullName !== original?.fullName) patch.fullName = data.fullName;
    if (data.phone !== normalizePhone(original?.phone)) patch.phone = data.phone;
    if (data.email.toLowerCase() !== original?.email?.toLowerCase()) {
      patch.email = data.email.toLowerCase();
    }
    if (data.birthDate !== original?.birthDate) patch.birthDate = data.birthDate;
    return patch;
  }

  async function onSubmit(data) {
    setSaveError(null);
    setSaveNotice(null);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setSaveNotice('Không có thay đổi để lưu.');
      return;
    }

    try {
      const updated = await updateMyStaffProfile(patch);
      const form = profileToForm(updated);
      setProfile(updated);
      setOriginal(form);
      reset(form);
      setUser((current) => ({ ...current, ...updated }));
      setSaveNotice('Đã cập nhật hồ sơ cá nhân.');
    } catch (err) {
      const handled = applyServerErrors(err, setError, {
        fields: ['fullName', 'phone', 'email', 'birthDate'],
      });
      if (!handled) setSaveError(err);
    }
  }

  async function onPasswordSubmit(data) {
    setPasswordServerError(null);
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
        setPasswordError('currentPassword', {
          type: 'server',
          message: 'Mật khẩu hiện tại không đúng.',
        });
      } else if (code === 'NEW_PASSWORD_SAME_AS_CURRENT') {
        setPasswordError('newPassword', {
          type: 'server',
          message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
        });
      } else {
        setPasswordServerError(err);
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

  if (loadError || !profile) {
    return (
      <div>
        <h1 className="h3 fw-bold mb-3">Hồ sơ cá nhân</h1>
        <ErrorAlert error={loadError} title="Không tải được hồ sơ cá nhân" />
        <Button type="button" variant="outline-danger" onClick={load}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Hồ sơ cá nhân</h1>
      <p className="text-muted mb-4">
        Cập nhật thông tin liên hệ của tài khoản đang đăng nhập.
      </p>

      <Row className="g-3">
        <Col xl={8}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                <div>
                  <h2 className="h5 mb-1">Thông tin nhân viên</h2>
                  <div className="small text-muted">
                    {ROLE_LABELS[profile.role] || profile.role || '—'} ·{' '}
                    {STATUS_LABELS[profile.status] || profile.status || '—'}
                  </div>
                </div>
              </div>

              <ErrorAlert
                error={saveError}
                title="Không lưu được hồ sơ"
                onClose={() => setSaveError(null)}
              />
              {saveNotice ? (
                <Alert variant={saveNotice.startsWith('Không có') ? 'warning' : 'success'}>
                  {saveNotice}
                </Alert>
              ) : null}

              <Form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="staff-profile-fullName">
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
                    <Form.Group controlId="staff-profile-phone">
                      <Form.Label>Số điện thoại *</Form.Label>
                      <Form.Control
                        {...register('phone')}
                        inputMode="numeric"
                        isInvalid={Boolean(errors.phone)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.phone?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="staff-profile-email">
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
                    <Form.Group controlId="staff-profile-birthDate">
                      <Form.Label>Ngày sinh *</Form.Label>
                      <Form.Control
                        type="date"
                        {...register('birthDate')}
                        max={getGymZoneTodayIsoDate()}
                        isInvalid={Boolean(errors.birthDate)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.birthDate?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2 mt-4">
                  <Button type="submit" variant="danger" disabled={isSubmitting}>
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      reset(original);
                      setSaveError(null);
                      setSaveNotice(null);
                    }}
                  >
                    Huỷ thay đổi
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 mb-1">Đổi mật khẩu</h2>
              <p className="small text-muted">
                Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.
              </p>

              <ErrorAlert
                error={passwordServerError}
                title="Không đổi được mật khẩu"
                onClose={() => setPasswordServerError(null)}
              />

              <Form onSubmit={handlePasswordSubmit(onPasswordSubmit)} noValidate>
                <Form.Group className="mb-3" controlId="staff-password-current">
                  <Form.Label>Mật khẩu hiện tại</Form.Label>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    {...registerPassword('currentPassword')}
                    autoComplete="current-password"
                    isInvalid={Boolean(passwordErrors.currentPassword)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {passwordErrors.currentPassword?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="staff-password-new">
                  <Form.Label>Mật khẩu mới</Form.Label>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    {...registerPassword('newPassword')}
                    autoComplete="new-password"
                    isInvalid={Boolean(passwordErrors.newPassword)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {passwordErrors.newPassword?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="staff-password-confirm">
                  <Form.Label>Xác nhận mật khẩu mới</Form.Label>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    {...registerPassword('confirmPassword')}
                    autoComplete="new-password"
                    isInvalid={Boolean(passwordErrors.confirmPassword)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {passwordErrors.confirmPassword?.message}
                  </Form.Control.Feedback>
                </Form.Group>
                <Form.Check
                  className="mb-3"
                  id="staff-password-show"
                  label="Hiện mật khẩu"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                <Button type="submit" variant="outline-danger" disabled={passwordSubmitting}>
                  {passwordSubmitting ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
