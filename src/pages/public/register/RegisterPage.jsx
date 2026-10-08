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
//
// Migration note (RHF + Zod):
//   - Inputs stay custom (icon + scms-login-* styling), not Bootstrap.
//   - RHF is registered onto each <input>. Inline errors are rendered
//     via the existing scms-login-fielderror style beside the input,
//     preserving the current visual structure (we do NOT redesign the
//     page to use isInvalid / Form.Control.Feedback).
//   - The legacy 13..120 age rule is preserved as a page-local refinement
//     on the birthDate schema. It is NOT part of the shared birthDate
//     fragment and must NOT be propagated to other forms.
//   - ACCOUNT_IDENTIFIER_ALREADY_EXISTS from the backend has no field
//     clue — it surfaces as a global ErrorAlert; do NOT guess email or phone.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import BrandLogo from '../../../components/common/BrandLogo';
import { registerRequest } from '../../../services/authService';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  fullNameSchema,
  emailSchema,
  phoneCreateSchema,
  passwordSchema,
  birthDateSchema,
} from '../../../schemas/fragments';

import './RegisterPage.css';
import '../auth/shared-auth.css';

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
// `error` prop (if present) is rendered below the field using the
// existing scms-login-fielderror CSS — the existing visual structure
// is preserved across the migration.
function Field({ id, label, icon, error, children }) {
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
      {error ? (
        <div className="scms-login-fielderror" role="alert">
          {error}
        </div>
      ) : null}
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

// Legacy FE-only age rule (pre-existing in the prior useState-based
// source). It is intentionally page-local and is NOT promoted into the
// shared birthDateSchema fragment.
const ageRefinedBirthDateSchema = birthDateSchema.refine(
  (d) => {
    const age = Math.floor(
      (Date.now() - new Date(d).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );
    return age >= 13 && age <= 120;
  },
  { message: 'Ngày sinh không hợp lệ.' },
);

const registerSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneCreateSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu.'),
    birthDate: ageRefinedBirthDateSchema,
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp.',
  });

export default function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      birthDate: '',
    },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      // Preserve existing payload normalization from the pre-migration
      // page: fullName trimmed, phone canonical (transform), email
      // trimmed+lowercased, password passed through unchanged (no
      // trim), birthDate as-is.
      await registerRequest({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email.toLowerCase(),
        password: data.password,
        birthDate: data.birthDate,
      });
      // 201 Created, no auto-login — send the user to login with a hint.
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      // Shared helper: data.errors + EMAIL/PHONE uniqueness.
      // The allowlist MUST match the fields this page actually renders
      // and registers; any backend field outside this list is treated
      // as unknown and falls through to the global ErrorAlert.
      //
      // Finalization rule: if the shared helper already rendered the
      // failure inline (handled === true), we MUST NOT also raise the
      // global ErrorAlert — the inline message is the only signal.
      // Otherwise the user would see the same EMAIL_ALREADY_EXISTS /
      // PHONE_ALREADY_EXISTS / data.errors[field] both inline and as a
      // duplicate global banner.
      const handled = applyServerErrors(err, setError, {
        fields: [
          'fullName',
          'phone',
          'email',
          'password',
          'confirmPassword',
          'birthDate',
        ],
      });
      if (!handled) {
        // Unknown / unmapped / non-field failures surface here.
        setServerError(err);
      }
      // ACCOUNT_IDENTIFIER_ALREADY_EXISTS is intentionally NOT mapped
      // to any field — the backend doesn't identify one. It falls
      // through to the global ErrorAlert via the `!handled` branch.
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
          error={serverError}
          title="Đăng ký thất bại"
          onClose={() => setServerError(null)}
        />

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field
            id="reg-fullName"
            label="Họ và tên"
            error={errors.fullName?.message}
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
              {...register('fullName')}
              placeholder="Ví dụ: Nguyễn Văn An"
              autoComplete="name"
            />
          </Field>

          <Field
            id="reg-phone"
            label="Số điện thoại"
            error={errors.phone?.message}
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
              {...register('phone')}
              placeholder="Ví dụ: 0912345678"
              inputMode="numeric"
              autoComplete="tel"
            />
          </Field>

          <Field
            id="reg-email"
            label="Địa chỉ Email"
            error={errors.email?.message}
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
              {...register('email')}
              placeholder="ten.nguoidung@gmail.com"
              autoComplete="email"
            />
          </Field>

          <Field
            id="reg-password"
            label="Mật khẩu"
            error={errors.password?.message}
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
              {...register('password')}
              placeholder="Tối thiểu 8 ký tự"
              autoComplete="new-password"
            />
            <EyeButton
              shown={showPassword}
              onToggle={() => setShowPassword((s) => !s)}
            />
          </Field>

          <Field
            id="reg-confirmPassword"
            label="Xác nhận mật khẩu"
            error={errors.confirmPassword?.message}
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
              {...register('confirmPassword')}
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
            />
            <EyeButton
              shown={showConfirm}
              onToggle={() => setShowConfirm((s) => !s)}
            />
          </Field>

          <Field
            id="reg-birthDate"
            label="Ngày sinh"
            error={errors.birthDate?.message}
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
              {...register('birthDate')}
              autoComplete="bday"
            />
          </Field>

          <button
            type="submit"
            className="scms-login-submit mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản ngay →'}
          </button>
        </form>

        <p className="scms-login-footer mt-3 mb-0">
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}
