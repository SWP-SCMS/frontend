// Login page.
//
// Handoff notes:
//   - Identifier is email OR phone (handled by backend).
//   - Invalid login returns a generic credential error.
//   - On success, AuthContext stores the profile; we navigate to the
//     intended destination (state.from) or role-based home.

import { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/useAuth';
import { ROLES } from '../../../constants';
import PublicShell from '../../../components/layout/PublicShell';
import AuthFormCard from '../AuthFormCard';
import ErrorAlert from '../../../components/common/ErrorAlert';

const ROLE_HOME = {
  [ROLES.MEMBER]: '/member/dashboard',
  [ROLES.RECEPTIONIST]: '/reception',
  [ROLES.COACH]: '/coach',
  [ROLES.MANAGER]: '/manager',
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
    <PublicShell>
      <AuthFormCard
        title="Đăng nhập"
        subtitle="Sử dụng email hoặc số điện thoại đã đăng ký."
      >
        <ErrorAlert
          error={error}
          title="Đăng nhập thất bại"
          onClose={() => setError(null)}
        />
        <Form onSubmit={handleSubmit} noValidate>
          <Form.Group className="mb-3" controlId="login-identifier">
            <Form.Label>Email hoặc số điện thoại</Form.Label>
            <Form.Control
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="email@example.com hoặc 0901234567"
              autoComplete="username"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="login-password">
            <Form.Label>Mật khẩu</Form.Label>
            <InputGroup>
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </Button>
            </InputGroup>
          </Form.Group>

          <Button
            type="submit"
            variant="danger"
            className="w-100"
            disabled={submitting || !identifier || !password}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </Form>
        <p className="text-center mt-3 mb-0 small">
          Chưa có tài khoản? <Link to="/register">Đăng ký hội viên</Link>
        </p>
      </AuthFormCard>
    </PublicShell>
  );
}
