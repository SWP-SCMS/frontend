import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BrandLogo from '../../../components/common/BrandLogo';
import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordReset,
} from '../../../services/authService';
import './shared-auth.css';
import '../login/LoginPage.css';
import './ForgotPasswordPage.css';

const ERROR_MESSAGES = {
  INVALID_OR_EXPIRED_OTP: 'Mã OTP không đúng hoặc đã hết hạn.',
  INVALID_PASSWORD_RESET_SESSION:
    'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu mã OTP mới.',
  NEW_PASSWORD_SAME_AS_CURRENT: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  RATE_LIMIT_EXCEEDED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
};

function messageOf(error, fallback) {
  const problem = error?.response?.data;
  return ERROR_MESSAGES[problem?.code] || problem?.detail || fallback;
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordBytes(value) {
  return new TextEncoder().encode(value).length;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp(event) {
    event?.preventDefault();
    setError(null);
    setNotice(null);
    const normalized = email.trim().toLowerCase();
    if (!validEmail(normalized)) {
      setError('Vui lòng nhập đúng địa chỉ email.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(normalized);
      setEmail(normalized);
      setStep('otp');
      setNotice(
        'Nếu email thuộc một tài khoản đang hoạt động, hệ thống đã gửi mã OTP tới địa chỉ đó.',
      );
    } catch (err) {
      setError(messageOf(err, 'Không thể gửi yêu cầu đặt lại mật khẩu.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    setBusy(true);
    try {
      const response = await verifyPasswordReset({ email, otp });
      setSessionExpiresAt(response.expiresAt || null);
      setStep('password');
    } catch (err) {
      setError(messageOf(err, 'Không thể xác thực mã OTP.'));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8 || passwordBytes(newPassword) > 72) {
      setError('Mật khẩu phải có ít nhất 8 ký tự và không quá 72 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset({ newPassword, confirmPassword });
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(messageOf(err, 'Không thể đặt lại mật khẩu.'));
      if (code === 'INVALID_PASSWORD_RESET_SESSION') {
        setStep('email');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scms-login-page">
      <BrandLogo className="scms-login-brand" />
      <div className="scms-login-card">
        <h1 className="h5 fw-bold mb-1">Đặt lại mật khẩu</h1>
        <p className="scms-login-subtitle">
          {step === 'email'
            ? 'Nhập email của tài khoản để nhận mã OTP.'
            : step === 'otp'
              ? `Nhập mã OTP đã gửi tới ${email}.`
              : 'Tạo mật khẩu mới cho tài khoản của bạn.'}
        </p>

        {notice ? <div className="scms-reset-notice">{notice}</div> : null}
        {error ? (
          <div className="scms-reset-error" role="alert">
            {error}
          </div>
        ) : null}

        {step === 'email' ? (
          <form onSubmit={sendOtp} noValidate>
            <label className="scms-login-label" htmlFor="reset-email">
              Email <span className="text-danger">*</span>
            </label>
            <input
              id="reset-email"
              className="scms-login-input scms-reset-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="email@example.com"
            />
            <button className="scms-login-submit mt-3" disabled={busy}>
              {busy ? 'Đang gửi...' : 'Gửi mã OTP'}
            </button>
          </form>
        ) : null}

        {step === 'otp' ? (
          <form onSubmit={verifyOtp} noValidate>
            <label className="scms-login-label" htmlFor="reset-otp">
              Mã OTP <span className="text-danger">*</span>
            </label>
            <input
              id="reset-otp"
              className="scms-login-input scms-reset-input"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
            />
            <button className="scms-login-submit mt-3" disabled={busy}>
              {busy ? 'Đang xác thực...' : 'Xác thực mã OTP'}
            </button>
            <button
              type="button"
              className="scms-reset-link-btn"
              onClick={sendOtp}
              disabled={busy}
            >
              Gửi lại mã OTP
            </button>
          </form>
        ) : null}

        {step === 'password' ? (
          <form onSubmit={savePassword} noValidate>
            {sessionExpiresAt ? (
              <p className="scms-reset-session-note">
                Phiên đặt lại mật khẩu chỉ có hiệu lực trong 10 phút.
              </p>
            ) : null}
            <label className="scms-login-label" htmlFor="reset-new-password">
              Mật khẩu mới <span className="text-danger">*</span>
            </label>
            <input
              id="reset-new-password"
              className="scms-login-input scms-reset-input mb-3"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <label className="scms-login-label" htmlFor="reset-confirm-password">
              Xác nhận mật khẩu mới <span className="text-danger">*</span>
            </label>
            <input
              id="reset-confirm-password"
              className="scms-login-input scms-reset-input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button className="scms-login-submit mt-3" disabled={busy}>
              {busy ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        ) : null}

        <p className="scms-login-footer mt-3 mb-0">
          <Link to="/login">← Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
