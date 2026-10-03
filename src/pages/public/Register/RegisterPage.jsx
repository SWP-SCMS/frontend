// Member self-registration (US02).
//
// Giao diện dùng lại các class của trang Login (.scms-login-*) để hai trang
// giống nhau: nền ảnh, logo góc trái, card kính mờ, nút đỏ.
//
// Required: fullName, phone, email, password, birthDate
// `confirmPassword` is FE-only (handoff §Member Self Registration).
// Mục tiêu tập luyện và ảnh hồ sơ là tùy chọn (BR-VAL-ACC-04), được bổ sung
// sau ở màn hình Profile nên không đưa vào form đăng ký.
//
// Note: emergency contact is captured later via the member profile update
// flow, not at registration. The current /auth/register DTO does not accept
// emergencyContact* fields (it rejects unknown fields with 400).

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorAlert from '../../../components/common/ErrorAlert';
import BrandLogo from '../../../components/common/BrandLogo';
import { registerRequest } from '../../../services/authService';
import { isValidPhone, normalizePhone } from '../../../utils';

const initialForm = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  birthDate: '',
};

// Icon SVG nhỏ, vẽ trực tiếp để không phải cài thư viện icon.
const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
      {children}
    </svg>
  );
}

// Một ô nhập có icon bên trái (dùng cho cả 6 trường).
function Field({ id, label, icon, children }) {
  return (
    <div className="mb-3">
      <label className="scms-login-label" htmlFor={id}>
        {label} <span className="text-danger">*</span>
      </label>
      <div className="scms-login-field">
        <span className="scms-login-field-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

// Nút con mắt hiện/ẩn mật khẩu.
function EyeButton({ shown, onToggle }) {
  return (
    <button
      type="button"
      className="scms-login-eye"
      onClick={onToggle}
      aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      <Icon size={18}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {shown ? <path d="M3 3l18 18" /> : null}
      </Icon>
    </button>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // FE validate để người dùng dễ dùng; BE vẫn kiểm tra lại (BR-SEC-04).
  function validate() {
    // BR-VAL-ACC-09: không được để trống sau khi chuẩn hóa khoảng trắng
    if (!form.fullName.trim()) return 'Vui lòng nhập họ tên.';
    // BR-VAL-ACC-06: SĐT và email phải đúng định dạng
    if (!isValidPhone(form.phone))
      return 'Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Email không hợp lệ.';
    // BR-VAL-ACC-05: mật khẩu >= 8 ký tự
    if (form.password.length < 8)
      return 'Mật khẩu phải có ít nhất 8 ký tự.';
    if (form.password !== form.confirmPassword)
      return 'Mật khẩu xác nhận không khớp.';
    // BR-VAL-ACC-01: ngày sinh bắt buộc; BR-VAL-ACC-06: không ở tương lai
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
      });
      // 201 Created, no auto-login — send the user to login with a hint.
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      // Luôn hiển thị lỗi BE trả về (vd: SĐT/email đã tồn tại).
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="scms-login-page">
      <BrandLogo className="scms-login-brand" />

      <div className="scms-login-card">
        <div className="scms-register-head">
          <div>
            <h1 className="h5 fw-bold mb-1">Đăng ký tài khoản</h1>
            <p className="scms-login-subtitle mb-0">
              Điền thông tin để tạo tài khoản hội viên mới
            </p>
          </div>
          <span className="scms-register-badge">
            <span className="scms-register-badge-dot" aria-hidden="true"></span>
            Hội viên mới
          </span>
        </div>

        <ErrorAlert
          error={error}
          title="Đăng ký thất bại"
          onClose={() => setError(null)}
        />

        <form onSubmit={handleSubmit} noValidate>
          <Field
            id="reg-fullName"
            label="Họ và tên"
            icon={
              <Icon>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </Icon>
            }
          >
            <input
              id="reg-fullName"
              className="scms-login-input"
              type="text"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              autoComplete="name"
              required
            />
          </Field>

          <Field
            id="reg-phone"
            label="Số điện thoại"
            icon={
              <Icon>
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
              </Icon>
            }
          >
            <input
              id="reg-phone"
              className="scms-login-input"
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="Ví dụ: 0912345678"
              inputMode="numeric"
              autoComplete="tel"
              required
            />
          </Field>

          <Field
            id="reg-email"
            label="Địa chỉ Email"
            icon={
              <Icon>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </Icon>
            }
          >
            <input
              id="reg-email"
              className="scms-login-input"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="ten.nguoidung@gmail.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field
            id="reg-password"
            label="Mật khẩu"
            icon={
              <Icon>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Icon>
            }
          >
            <input
              id="reg-password"
              className="scms-login-input"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
              required
            />
            <EyeButton
              shown={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />
          </Field>

          <Field
            id="reg-confirmPassword"
            label="Xác nhận mật khẩu"
            icon={
              <Icon>
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <path d="M21 3v5h-5" />
              </Icon>
            }
          >
            <input
              id="reg-confirmPassword"
              className="scms-login-input"
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
              required
            />
            <EyeButton
              shown={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
            />
          </Field>

          <Field
            id="reg-birthDate"
            label="Ngày sinh"
            icon={
              <Icon>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </Icon>
            }
          >
            <input
              id="reg-birthDate"
              className="scms-login-input scms-register-date"
              type="date"
              value={form.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
              autoComplete="bday"
              required
            />
          </Field>

          <button
            type="submit"
            className="scms-login-submit mt-4"
            disabled={submitting}
          >
            {submitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản ngay →'}
          </button>
        </form>

        <p className="scms-login-footer mt-3 mb-0">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}
