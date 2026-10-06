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

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, InputGroup } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { changePasswordRequest } from '../../../services/authService';
import { useAuth } from '../../../context/useAuth';

import './MemberChangePasswordPage.css';

const initial = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function MemberChangePasswordPage() {
  const { terminateSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.currentPassword) return 'Vui lòng nhập mật khẩu hiện tại.';
    if (form.newPassword.length < 8)
      return 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    if (form.newPassword === form.currentPassword)
      return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    if (form.newPassword !== form.confirmPassword)
      return 'Mật khẩu xác nhận không khớp.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await changePasswordRequest({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Backend terminated the session — clear local auth state and
      // send the user back to login. We do NOT try to keep them logged
      // in here, per BR decision.
      await terminateSession();
      navigate('/login?changed=1', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scms-auth-wrap-wide">
      <h1 className="h3 fw-bold mb-1">Đổi mật khẩu</h1>
      <p className="text-muted mb-4">
        Sau khi đổi thành công, bạn sẽ được đăng xuất và cần đăng nhập lại.
      </p>

      <ErrorAlert
        error={error}
        title="Không đổi được mật khẩu"
        onClose={() => setError(null)}
      />

      <Form onSubmit={handleSubmit} noValidate>
        <Form.Group className="mb-3" controlId="cp-current">
          <Form.Label>Mật khẩu hiện tại</Form.Label>
          <InputGroup>
            <Form.Control
              type={showCurrent ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={(e) => update('currentPassword', e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button
              variant="outline-secondary"
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
            >
              {showCurrent ? 'Ẩn' : 'Hiện'}
            </Button>
          </InputGroup>
        </Form.Group>

        <Form.Group className="mb-3" controlId="cp-new">
          <Form.Label>Mật khẩu mới</Form.Label>
          <InputGroup>
            <Form.Control
              type={showNew ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(e) => update('newPassword', e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Button
              variant="outline-secondary"
              type="button"
              onClick={() => setShowNew((s) => !s)}
            >
              {showNew ? 'Ẩn' : 'Hiện'}
            </Button>
          </InputGroup>
          <Form.Text className="text-muted">Tối thiểu 8 ký tự.</Form.Text>
        </Form.Group>

        <Form.Group className="mb-4" controlId="cp-confirm">
          <Form.Label>Xác nhận mật khẩu mới</Form.Label>
          <Form.Control
            type="password"
            value={form.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            autoComplete="new-password"
            required
          />
        </Form.Group>

        <div className="d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
          </Button>
          <Button as={Link} to="/member/profile" variant="outline-secondary">
            Quay lại
          </Button>
        </div>
      </Form>
    </div>
  );
}
