// Login page.
//
// Handoff notes:
//   - Identifier is email OR phone (handled by backend).
//   - Invalid login returns a generic credential error.
//   - On success, AuthContext stores the profile; we navigate to the
//     intended destination (state.from) or role-based home.
//   - `?changed=1` means "đổi mật khẩu thành công, phiên cũ đã kết thúc" —
//     báo người dùng trước khi họ điền form. Xem MemberChangePasswordPage.

import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { ROLES } from '../../../constants';
import ErrorAlert from '../../../components/common/ErrorAlert';
import BrandLogo from '../../../components/common/BrandLogo';

const ROLE_HOME = {
  [ROLES.MEMBER]: '/member/dashboard',
  [ROLES.RECEPTIONIST]: '/reception',
  [ROLES.COACH]: '/coach',
  // Manager goes straight to the dashboard so they don't land on a
  // bare redirect at "/manager" before bouncing again.
  [ROLES.MANAGER]: '/manager/dashboard',
};

// Icon SVG nhỏ, vẽ trực tiếp để không phải cài thư viện icon.
const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export default function LoginPage() {
  const { login, isAuthenticated, role, isReady } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loginResolved, setLoginResolved] = useState(false);

  // Đổi mật khẩu xong: BE đã kết thúc phiên nên người dùng bị đưa về đây
  // kèm `?changed=1`. Hiện thông báo thành công rồi xoá param — nếu giữ lại
  // thì F5 sẽ báo lại lần nữa, gây hiểu nhầm là vừa đổi xong.
  const passwordChanged = params.get('changed') === '1';

  function dismissPasswordChangedNotice() {
    params.delete('changed');
    setParams(params, { replace: true });
  }

  // When login() resolves successfully, send the user to the role-aware
  // home via a declarative <Navigate> on the next render. This is more
  // reliable than imperative navigate() inside an async handler because
  // it ties the redirect to the same state update that flips isReady +
  // isAuthenticated + role.
  if (loginResolved && isReady && isAuthenticated && role) {
    const fallback = ROLE_HOME[role] || '/';
    const target = location.state?.from?.pathname || fallback;
    return <Navigate to={target} replace />;
  }

  // While we wait for the first auth bootstrap to settle, render nothing
  // (we already know the user is authenticated, so we shouldn't show the
  // form briefly — but we also can't navigate yet because `role` is null).
  if (isReady && isAuthenticated && !role) {
    return null;
  }

  // If the user is already authenticated with a role but landed on /login
  // directly (e.g. via URL paste), still send them away.
  if (loginResolved === false && isReady && isAuthenticated && role) {
    const fallback = ROLE_HOME[role] || '/';
    const target = location.state?.from?.pathname || fallback;
    return <Navigate to={target} replace />;
  }

  // BR-AUTH-01: đăng nhập bằng email OR SĐT + mật khẩu (BE tự phân biệt).
  // BR-AUTH-04: hiển thị lỗi chung do BE trả về, FE không đoán sai ở trường nào.
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login({ identifier: identifier.trim(), password });
      // Trigger a re-render so the `isAuthenticated` guard below sends us
      // to the role-aware home. We deliberately don't call navigate()
      // here — the guard handles it deterministically on the next render.
      setLoginResolved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scms-login-page">
      <BrandLogo className="scms-login-brand" />

      <div className="scms-login-card">
        <h1 className="h5 fw-bold mb-1">Đăng nhập tài khoản</h1>
        <p className="scms-login-subtitle">
          Sử dụng email hoặc số điện thoại đã đăng ký.
        </p>

        <ErrorAlert
          error={error}
          title="Đăng nhập thất bại"
          onClose={() => setError(null)}
        />

        {passwordChanged ? (
          <div className="scms-login-notice" role="status">
            <span className="scms-login-notice-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" {...iconProps}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span>
              Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.
            </span>
            <button
              type="button"
              className="scms-login-notice-close"
              onClick={dismissPasswordChangedNotice}
              aria-label="Đóng thông báo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" {...iconProps}>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="scms-login-label" htmlFor="login-identifier">
              Email hoặc số điện thoại <span className="text-danger">*</span>
            </label>
            <div className="scms-login-field">
              <span className="scms-login-field-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" {...iconProps}>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-10 6L2 7" />
                </svg>
              </span>
              <input
                id="login-identifier"
                className="scms-login-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com hoặc 0901234567"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="scms-login-label" htmlFor="login-password">
              Mật khẩu xác thực <span className="text-danger">*</span>
            </label>
            <div className="scms-login-field">
              <span className="scms-login-field-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" {...iconProps}>
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                className="scms-login-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="scms-login-eye"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" {...iconProps}>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword ? <path d="M3 3l18 18" /> : null}
                </svg>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="scms-login-submit"
            disabled={submitting || !identifier || !password}
          >
            {submitting ? 'Đang xác thực...' : 'Đăng nhập hệ thống SWP GYM'}
          </button>
        </form>

        <p className="scms-login-footer mt-3 mb-0">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}
