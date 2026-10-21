import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../components/common/ErrorAlert';
import { ROLES } from '../../constants';
import { useAuth } from '../../context/useAuth';
import { emailSchema } from '../../schemas/fragments';
import {
  beginStaffEmailChange,
  cancelStaffEmailChange,
  getMyStaffProfile,
  resendStaffEmailChange,
  verifyStaffEmailChange,
} from '../../services/staffProfileService';

const PROFILE_PATHS = {
  [ROLES.MANAGER]: '/manager/profile',
  [ROLES.RECEPTIONIST]: '/reception/profile',
  [ROLES.COACH]: '/coach/profile',
};

const emailSchemaWithPassword = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
});
const otpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số.') });
const ERROR_MESSAGES = {
  EMAIL_UNCHANGED: 'Email mới phải khác email hiện tại.',
  EMAIL_ALREADY_EXISTS: 'Email này đã được một tài khoản khác sử dụng.',
  EMAIL_CHANGE_PENDING: 'Bạn đang có một yêu cầu đổi email chờ xác thực.',
  INVALID_OR_EXPIRED_OTP: 'Mã OTP không đúng hoặc đã hết hạn.',
  EMAIL_VERIFICATION_UNAVAILABLE: 'Dịch vụ gửi email hiện không khả dụng. Vui lòng thử lại sau.',
};

function errorMessage(error) {
  return ERROR_MESSAGES[error?.response?.data?.code] || error?.response?.data?.detail || 'Không thể xử lý yêu cầu đổi email.';
}

function secondsUntil(target, serverTime, receivedAt, now) {
  if (!target) return 0;
  const baseTime = serverTime ? new Date(serverTime).getTime() : receivedAt;
  return Math.max(0, Math.ceil((new Date(target).getTime() - (baseTime + now - receivedAt)) / 1000));
}

function formatCountdown(totalSeconds) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export default function StaffChangeEmailPage() {
  const navigate = useNavigate();
  const { role, terminateSession } = useAuth();
  const profilePath = PROFILE_PATHS[role] || '/';
  const [currentEmail, setCurrentEmail] = useState('');
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [verifiedEmail, setVerifiedEmail] = useState(null);

  const emailForm = useForm({
    resolver: zodResolver(emailSchemaWithPassword),
    defaultValues: { newEmail: '', currentPassword: '' },
  });
  const otpForm = useForm({ resolver: zodResolver(otpSchema), defaultValues: { otp: '' } });

  const applyMeta = useCallback((data) => {
    const receivedAt = Date.now();
    setClockNow(receivedAt);
    setMeta({
      maskedEmail: data.maskedEmail,
      otpExpiresAt: data.otpExpiresAt,
      resendAvailableAt: data.resendAvailableAt,
      serverTime: data.serverTime || null,
      receivedAt,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getMyStaffProfile();
      setCurrentEmail(profile.email || '');
      if (profile.pendingEmailChange) {
        applyMeta({
          maskedEmail: profile.pendingEmailMasked,
          otpExpiresAt: profile.pendingEmailOtpExpiresAt,
          resendAvailableAt: profile.pendingEmailResendAvailableAt,
        });
      }
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [applyMeta]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!meta) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [meta]);

  async function begin(data) {
    setServerError(null);
    setNotice(null);
    try {
      const response = await beginStaffEmailChange({ newEmail: data.newEmail.trim().toLowerCase(), currentPassword: data.currentPassword });
      applyMeta(response);
      emailForm.reset();
      otpForm.reset();
      setNotice('Đã gửi mã OTP tới email mới.');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'CURRENT_PASSWORD_INCORRECT') {
        emailForm.setError('currentPassword', { type: 'server', message: 'Mật khẩu hiện tại không đúng.' });
      } else if (code === 'EMAIL_UNCHANGED' || code === 'EMAIL_ALREADY_EXISTS') {
        emailForm.setError('newEmail', { type: 'server', message: errorMessage(err) });
      } else setServerError(err);
    }
  }

  async function verify(data) {
    setServerError(null);
    setNotice(null);
    try {
      const response = await verifyStaffEmailChange({ otp: data.otp });
      setVerifiedEmail(response.email || meta?.maskedEmail || 'email mới');
    } catch (err) {
      if (err?.response?.data?.code === 'INVALID_OR_EXPIRED_OTP') {
        otpForm.setError('otp', { type: 'server', message: errorMessage(err) });
      } else setServerError(err);
    }
  }

  async function confirmVerifiedEmail() {
    await terminateSession();
    navigate('/login?emailChanged=1', { replace: true });
  }

  async function resend() {
    setBusy(true);
    setServerError(null);
    setNotice(null);
    try {
      applyMeta(await resendStaffEmailChange());
      otpForm.reset();
      setNotice('Đã gửi lại mã OTP.');
    } catch (err) {
      const problem = err?.response?.data;
      if (problem?.code === 'RESEND_COOLDOWN' && problem.resendAvailableAt) {
        applyMeta({ ...meta, resendAvailableAt: problem.resendAvailableAt, serverTime: problem.serverTime });
      }
      setServerError(err);
    } finally { setBusy(false); }
  }

  async function cancel() {
    setBusy(true);
    setServerError(null);
    setNotice(null);
    try {
      await cancelStaffEmailChange();
      setMeta(null);
      otpForm.reset();
      setNotice('Đã hủy yêu cầu đổi email.');
    } catch (err) {
      setServerError(err);
    } finally { setBusy(false); }
  }

  const resendSeconds = meta ? secondsUntil(meta.resendAvailableAt, meta.serverTime, meta.receivedAt, clockNow) : 0;
  const otpSeconds = meta ? secondsUntil(meta.otpExpiresAt, meta.serverTime, meta.receivedAt, clockNow) : 0;

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (loadError) return <div><ErrorAlert error={loadError} title="Không tải được yêu cầu đổi email" /><Button variant="outline-danger" onClick={load}>Thử lại</Button></div>;

  return (
    <div>
      <Link to={profilePath} className="d-inline-block mb-3">← Quay lại hồ sơ cá nhân</Link>
      <h1 className="h3 fw-bold mb-1">Đổi email</h1>
      <p className="text-muted mb-4">Email hiện tại: <strong>{currentEmail || '—'}</strong></p>
      <Card className="border-0 shadow-sm" style={{ maxWidth: 720 }}>
        <Card.Body className="p-4">
          {serverError ? <Alert variant="danger" dismissible onClose={() => setServerError(null)}>{errorMessage(serverError)}</Alert> : null}
          {notice ? <Alert variant="success" dismissible onClose={() => setNotice(null)}>{notice}</Alert> : null}
          {meta ? (
            <Form onSubmit={otpForm.handleSubmit(verify)} noValidate>
              <Alert variant="info">Mã OTP đã được gửi tới <strong>{meta.maskedEmail || 'email mới'}</strong>.{otpSeconds > 0 ? ` Mã còn hiệu lực ${formatCountdown(otpSeconds)}.` : ' Mã đã hết hạn.'}</Alert>
              <Form.Group className="mb-3" controlId="staff-email-change-otp">
                <Form.Label>Mã OTP *</Form.Label>
                <Form.Control {...otpForm.register('otp')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} isInvalid={Boolean(otpForm.formState.errors.otp)} />
                <Form.Control.Feedback type="invalid">{otpForm.formState.errors.otp?.message}</Form.Control.Feedback>
              </Form.Group>
              <div className="d-flex flex-wrap gap-2">
                <Button type="submit" variant="danger" disabled={otpForm.formState.isSubmitting || busy || otpSeconds <= 0}>{otpForm.formState.isSubmitting ? 'Đang xác thực...' : 'Xác thực email mới'}</Button>
                <Button type="button" variant="outline-danger" disabled={otpForm.formState.isSubmitting || busy || resendSeconds > 0} onClick={resend}>{resendSeconds > 0 ? `Gửi lại sau ${formatCountdown(resendSeconds)}` : 'Gửi lại mã OTP'}</Button>
                <Button type="button" variant="outline-secondary" disabled={otpForm.formState.isSubmitting || busy} onClick={cancel}>Hủy yêu cầu</Button>
              </div>
            </Form>
          ) : (
            <Form onSubmit={emailForm.handleSubmit(begin)} noValidate>
              <Form.Group className="mb-3" controlId="staff-email-change-new">
                <Form.Label>Email mới *</Form.Label>
                <Form.Control type="email" {...emailForm.register('newEmail')} maxLength={320} autoComplete="email" isInvalid={Boolean(emailForm.formState.errors.newEmail)} />
                <Form.Control.Feedback type="invalid">{emailForm.formState.errors.newEmail?.message}</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-3" controlId="staff-email-change-password">
                <Form.Label>Mật khẩu hiện tại *</Form.Label>
                <Form.Control type="password" {...emailForm.register('currentPassword')} autoComplete="current-password" isInvalid={Boolean(emailForm.formState.errors.currentPassword)} />
                <Form.Control.Feedback type="invalid">{emailForm.formState.errors.currentPassword?.message}</Form.Control.Feedback>
              </Form.Group>
              <div className="d-flex gap-2">
                <Button type="submit" variant="danger" disabled={emailForm.formState.isSubmitting}>{emailForm.formState.isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}</Button>
                <Button as={Link} to={profilePath} variant="outline-secondary" disabled={emailForm.formState.isSubmitting}>Hủy</Button>
              </div>
            </Form>
          )}
        </Card.Body>
      </Card>

      <Modal show={Boolean(verifiedEmail)} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title className="h5">Đổi email thành công</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Email tài khoản đã được đổi thành <strong>{verifiedEmail}</strong>.
          Bạn cần đăng nhập lại để tiếp tục sử dụng hệ thống.
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="danger" onClick={confirmVerifiedEmail}>
            Xác nhận và đăng nhập lại
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
