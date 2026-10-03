// Login page.
//
// Handoff notes:
//   - Identifier is email OR phone (handled by backend).
//   - Invalid login returns a generic credential error.
//   - On success, AuthContext stores the profile; we navigate to the
//     intended destination (state.from) or role-based home.

import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { ROLES } from '../../../constants';
import ErrorAlert from '../../../components/common/ErrorAlert';
import BrandLogo from '../../../components/common/BrandLogo';

const ROLE_HOME = {
  [ROLES.MEMBER]: '/member/dashboard',
  [ROLES.RECEPTIONIST]: '/reception',
  [ROLES.COACH]: '/coach',
  [ROLES.MANAGER]: '/manager',
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
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (isReady && isAuthenticated) {
    const fallback = ROLE_HOME[role] || '/';
    const target = location.state?.from?.pathname || fallback;
    return <Navigate to={target} replace />;
  }

  // BR-AUTH-01: đăng nhập bằng email hoặc SĐT + mật khẩu (BE tự phân biệt).
  // BR-AUTH-04: hiển thị lỗi chung do BE trả về, FE không đoán sai ở trường nào.
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login({ identifier: identifier.trim(), password });
      const target = location.state?.from?.pathname || ROLE_HOME[profile?.role] || '/';
      navigate(target, { replace: true });
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
