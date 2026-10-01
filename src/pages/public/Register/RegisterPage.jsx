// Member self-registration.
//
// Required: fullName, phone, email, password, birthDate
// Optional: profileImageUrl, fitnessGoal.
// `confirmPassword` is FE-only (handoff §Member Self Registration).
//
// Note: emergency contact is captured later via the member profile update
// flow, not at registration. The current /auth/register DTO does not accept
// emergencyContact* fields (it rejects unknown fields with 400).

import { useState } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import PublicShell from '../../../components/layout/PublicShell';
import AuthFormCard from '../AuthFormCard';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { registerRequest } from '../../../services/authService';
import { isValidPhone, normalizePhone } from '../../../utils';

const initialForm = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  birthDate: '',
  profileImageUrl: '',
  fitnessGoal: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ tên.';
    if (!isValidPhone(form.phone))
      return 'Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Email không hợp lệ.';
    if (form.password.length < 8)
      return 'Mật khẩu phải có ít nhất 8 ký tự.';
    if (form.password !== form.confirmPassword)
      return 'Mật khẩu xác nhận không khớp.';
    if (!form.birthDate) return 'Vui lòng nhập ngày sinh.';
    const age = Math.floor(
      (Date.now() - new Date(form.birthDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );
    if (age < 13 || age > 120) return 'Ngày sinh không hợp lệ.';
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
      await registerRequest({
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        birthDate: form.birthDate,
        profileImageUrl: form.profileImageUrl.trim() || null,
        fitnessGoal: form.fitnessGoal.trim() || null,
      });
      // 201 Created, no auto-login — send the user to login with a hint.
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <AuthFormCard
        title="Đăng ký hội viên"
        subtitle="Tạo tài khoản để bắt đầu hành trình tập luyện."
        footer="Sau khi đăng ký thành công, vui lòng đăng nhập để tiếp tục."
      >
        <ErrorAlert
          error={error}
          title="Đăng ký thất bại"
          onClose={() => setError(null)}
        />
        <Form onSubmit={handleSubmit} noValidate>
          <Form.Group className="mb-3" controlId="reg-fullName">
            <Form.Label>Họ và tên</Form.Label>
            <Form.Control
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              autoComplete="name"
              required
            />
          </Form.Group>

          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="reg-phone">
                <Form.Label>Số điện thoại</Form.Label>
                <Form.Control
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="0901234567"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="reg-email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  autoComplete="email"
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-3 mt-1">
            <Col md={6}>
              <Form.Group controlId="reg-password">
                <Form.Label>Mật khẩu</Form.Label>
                <Form.Control
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <Form.Text className="text-muted">Tối thiểu 8 ký tự.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="reg-confirmPassword">
                <Form.Label>Xác nhận mật khẩu</Form.Label>
                <Form.Control
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mt-3" controlId="reg-birthDate">
            <Form.Label>Ngày sinh</Form.Label>
            <Form.Control
              type="date"
              value={form.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
              autoComplete="bday"
              required
            />
          </Form.Group>

          <Form.Group className="mt-3" controlId="reg-fitnessGoal">
            <Form.Label>Mục tiêu tập luyện (tuỳ chọn)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={form.fitnessGoal}
              onChange={(e) => update('fitnessGoal', e.target.value)}
              placeholder="Ví dụ: giảm cân, tăng cơ, cải thiện sức bền..."
            />
          </Form.Group>

          <Button
            type="submit"
            variant="danger"
            className="w-100 mt-4"
            disabled={submitting}
          >
            {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
          </Button>
        </Form>
        <p className="text-center mt-3 mb-0 small">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </AuthFormCard>
    </PublicShell>
  );
}
