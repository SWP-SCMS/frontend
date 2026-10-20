import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import BrandLogo from '../../../components/common/BrandLogo';
import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  changePendingEmailRequest,
  resendVerificationEmailRequest,
  verifyEmailRequest,
} from '../../../services/authService';
import { emailSchema } from '../../../schemas/fragments';
import './shared-auth.css';

const STORAGE_KEY = 'scms.pendingEmailVerification';
const PAGE_LOADED_AT = Date.now();

const verifySchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm đúng 6 chữ số.'),
});

const changeSchema = z.object({ newEmail: emailSchema });

const ERROR_MESSAGES = {
  INVALID_OR_EXPIRED_OTP: 'Mã OTP không đúng hoặc đã hết hạn.',
  INVALID_PENDING_SESSION: 'Phiên đổi email đã hết hạn. Bạn vẫn có thể gửi lại hoặc nhập OTP.',
  INVALID_PENDING_ORIGIN: 'Nguồn gửi yêu cầu không hợp lệ. Vui lòng tải lại trang.',
  EMAIL_CHANGE_LIMIT_EXCEEDED: 'Bạn đã đổi email quá số lần cho phép trong phiên đăng ký này.',
  EMAIL_ALREADY_EXISTS: 'Email này đã được sử dụng.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.',
};

function displayError(error) {
  const message = ERROR_MESSAGES[error?.response?.data?.code];
  return message ? new Error(message) : error;
}

function readStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function secondsUntil(value, serverTime, receivedAt, currentTime) {
  if (!value) return 0;
  const serverNow = serverTime ? Date.parse(serverTime) : receivedAt;
  const adjustedNow = serverNow + (currentTime - receivedAt);
  return Math.max(0, Math.ceil((Date.parse(value) - adjustedNow) / 1000));
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(() => {
    const stored = readStored();
    const incoming = location.state || {};
    return {
      ...stored,
      ...incoming,
      receivedAt: location.state ? PAGE_LOADED_AT : stored.receivedAt || PAGE_LOADED_AT,
    };
  });
  const [nowTick, setNowTick] = useState(PAGE_LOADED_AT);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [resending, setResending] = useState(false);
  const [changing, setChanging] = useState(false);

  const verifyForm = useForm({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: meta.email || '', otp: '' },
  });
  const changeForm = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { newEmail: meta.email || '' },
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }, [meta]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resendSeconds = useMemo(
    () => secondsUntil(meta.resendAvailableAt, meta.serverTime, meta.receivedAt, nowTick),
    [meta.resendAvailableAt, meta.serverTime, meta.receivedAt, nowTick],
  );

  async function submitVerify(values) {
    setError(null);
    setNotice('');
    try {
      await verifyEmailRequest(values);
      sessionStorage.removeItem(STORAGE_KEY);
      navigate('/login?verified=1', { replace: true });
    } catch (err) {
      setError(displayError(err));
    }
  }

  async function resend() {
    const email = verifyForm.getValues('email');
    if (!email || resendSeconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const response = await resendVerificationEmailRequest({ email });
      setMeta((current) => ({ ...current, ...response, email, receivedAt: Date.now() }));
      setNotice('Nếu tài khoản đang chờ xác thực, mã OTP mới đã được gửi.');
    } catch (err) {
      setError(displayError(err));
    } finally {
      setResending(false);
    }
  }

  async function submitChange(values) {
    if (!meta.csrfToken) {
      setError(new Error('Phiên đổi email không còn trên trình duyệt này. Bạn vẫn có thể xác thực hoặc gửi lại OTP.'));
      return;
    }
    setChanging(true);
    setError(null);
    try {
      const response = await changePendingEmailRequest({
        newEmail: values.newEmail,
        csrfToken: meta.csrfToken,
      });
      const email = values.newEmail.toLowerCase();
      setMeta((current) => ({ ...current, ...response, email, receivedAt: Date.now() }));
      verifyForm.setValue('email', email);
      verifyForm.setValue('otp', '');
      setNotice(`Đã đổi email thành ${response.maskedEmail}. Vui lòng nhập OTP mới.`);
    } catch (err) {
      setError(displayError(err));
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="scms-login-page">
      <BrandLogo className="scms-login-brand" />
      <div className="scms-login-card" style={{ maxWidth: 520 }}>
        <h1 className="h5 fw-bold mb-1">Xác thực email</h1>
        <p className="scms-login-subtitle">
          Nhập mã OTP 6 chữ số đã gửi tới {meta.maskedEmail || 'email đăng ký'}.
        </p>

        {notice ? <div className="alert alert-success py-2">{notice}</div> : null}
        <ErrorAlert error={error} title="Không thể xác thực email" onClose={() => setError(null)} />

        <form onSubmit={verifyForm.handleSubmit(submitVerify)} noValidate>
          <label className="scms-login-label" htmlFor="verify-email">Email</label>
          <div className="scms-login-field mb-1">
            <input id="verify-email" type="email" className="scms-login-input" {...verifyForm.register('email')} />
          </div>
          {verifyForm.formState.errors.email ? <div className="scms-login-fielderror mb-2">{verifyForm.formState.errors.email.message}</div> : null}

          <label className="scms-login-label mt-3" htmlFor="verify-otp">Mã OTP</label>
          <div className="scms-login-field mb-1">
            <input id="verify-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="scms-login-input" {...verifyForm.register('otp')} />
          </div>
          {verifyForm.formState.errors.otp ? <div className="scms-login-fielderror">{verifyForm.formState.errors.otp.message}</div> : null}

          <button type="submit" className="scms-login-submit mt-4" disabled={verifyForm.formState.isSubmitting}>
            {verifyForm.formState.isSubmitting ? 'Đang xác thực…' : 'Xác thực tài khoản'}
          </button>
        </form>

        <button type="button" className="btn btn-link w-100 mt-2" onClick={resend} disabled={resending || resendSeconds > 0}>
          {resendSeconds > 0 ? `Gửi lại sau ${formatCountdown(resendSeconds)}` : resending ? 'Đang gửi…' : 'Gửi lại mã OTP'}
        </button>

        <details className="mt-3">
          <summary className="small">Email đăng ký chưa đúng?</summary>
          <form className="mt-2" onSubmit={changeForm.handleSubmit(submitChange)} noValidate>
            <input type="email" className="form-control" {...changeForm.register('newEmail')} />
            {changeForm.formState.errors.newEmail ? <div className="text-danger small mt-1">{changeForm.formState.errors.newEmail.message}</div> : null}
            <button type="submit" className="btn btn-outline-danger btn-sm mt-2" disabled={changing || !meta.csrfToken}>
              {changing ? 'Đang đổi…' : 'Đổi email và gửi OTP mới'}
            </button>
          </form>
        </details>

        <p className="scms-login-footer mt-3 mb-0"><Link to="/login">← Quay lại đăng nhập</Link></p>
      </div>
    </div>
  );
}
