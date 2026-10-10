// Hồ sơ cá nhân của Hội viên (US03), nằm trong MemberLayout.
//
// API:
//   GET   /api/v1/members/me/profile   - tải hồ sơ
//   PATCH /api/v1/members/me/profile   - lưu thay đổi
//     * trường bỏ qua  -> giữ nguyên
//     * null ở trường tùy chọn -> xóa giá trị
//     * trùng SĐT/email -> 409 (hiển thị lỗi BE trả về)
//
// Chỉ gửi những trường người dùng thực sự đổi (so với dữ liệu BE vừa trả về).
// Đổi mật khẩu nằm ở trang riêng /member/profile/password (US04).
//
// Các trường BE chưa hỗ trợ (giới tính, địa chỉ, mối quan hệ, khung giờ liên
// hệ, ghi chú chấn thương, tải ảnh từ máy, ngày gia nhập) được giữ lại trên
// giao diện ở dạng làm mờ, ghi "Sắp ra mắt". Thẻ chỉ số InBody đã bỏ.
//
// Migration note (RHF + Zod):
//   - profileImageUrl http(s) regex is intentionally PAGE-LOCAL. It is NOT
//     promoted to a shared fragment and is NOT applied to F05 / F06.
//   - phone is required and uses normalizePhone. F04's contract differs
//     from the optional blank-phone edit semantics of F08 / F09; the
//     phoneEditOptionalSchema is NOT used here.
//   - PATCH uses a buildPatch() diff against `original`; unchanged fields
//     are OMITTED (preserved exactly from the pre-migration source).
//   - RHF owns editable form values. `original` is kept as a separate
//     useState for the diff. Async loaded data enters via reset(...).
//   - Local `Field` is a plain wrapper (no forwardRef): every RHF
//     `register()` call is spread directly onto the child <input> /
//     <textarea>, so the ref reaches the real control without any
//     wrapper forwarding. The wrapper itself just renders the label
//     and the children.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import MemberBreadcrumb from '../../../components/layout/MemberBreadcrumb';
import { getMyProfile, updateMyProfile } from '../../../services/memberService';
import { useAuth } from '../../../context/useAuth';
import { extractErrorMessage, formatDate, normalizePhone } from '../../../utils';
import { applyServerErrors } from '../../../utils/serverErrors';
import { emailSchema, birthDateSchema } from '../../../schemas/fragments';

import './MemberProfilePage.css';

// Page-local schema. Reuses shared fragments where semantics match
// (email, birthDate) and keeps page-local rules where they differ:
//   - fullName: 1..200, trim (BR-VAL-ACC-09)
//   - phone: required, normalized 10-digit (F04's contract is REQUIRED;
//     this differs from F08/F09's optional-blank semantics and is
//     therefore NOT shared with phoneEditOptionalSchema)
//   - profileImageUrl: optional, when present must be http(s)://...
//     (BR-ACC-11 — page-local by intent, NOT shared with F05 / F06)
//   - fitnessGoal: optional, free text
//   - emergencyContactName / emergencyContactPhone: optional, must
//     be both present or both empty (BR-ACC-09 pairing rule).
const optionalHttpUrl = z
  .string()
  .refine(
    (s) => s === '' || /^https?:\/\/\S+$/i.test(s),
    'Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://.',
  );

const memberProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập họ tên.')
      .max(200, 'Họ tên không được vượt quá 200 ký tự.'),
    phone: z
      .string()
      .trim()
      .refine(
        (s) => normalizePhone(s) != null,
        'Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.',
      )
      .transform((s) => normalizePhone(s)),
    email: emailSchema,
    birthDate: birthDateSchema,
    profileImageUrl: optionalHttpUrl,
    fitnessGoal: z.string(),
    emergencyContactName: z.string(),
    emergencyContactPhone: z.string(),
  })
  .superRefine((d, ctx) => {
    const ecName = (d.emergencyContactName || '').trim();
    const ecPhone = (d.emergencyContactPhone || '').trim();
    if ((ecName === '') !== (ecPhone === '')) {
      ctx.addIssue({
        path: ['emergencyContactPhone'],
        code: 'custom',
        message:
          'Liên hệ khẩn cấp phải nhập cả họ tên và số điện thoại.',
      });
    } else if (ecPhone !== '' && normalizePhone(ecPhone) == null) {
      ctx.addIssue({
        path: ['emergencyContactPhone'],
        code: 'custom',
        message: 'Số điện thoại liên hệ khẩn cấp không hợp lệ.',
      });
    }
  });

const GOAL_PRESETS = [
  'Tăng cơ - Giảm mỡ',
  'Cải thiện sức bền Cardio',
  'Tăng cường sức mạnh cơ bắp',
  'Rèn luyện thói quen vận động',
];

// ----- Icon SVG vẽ trực tiếp (không cài thương hiệun icon) -----

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ICONS = {
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m17 8-5-5-5 5M12 3v12" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  badge: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M15 9h3M15 13h3M6 17c.5-1.5 1.7-2 3-2s2.5.5 3 2" />
    </>
  ),
  tip: (
    <>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.2-8.2M16 7l3 3" />
    </>
  ),
  exercise: (
    <>
      <path d="M6.5 6.5l11 11" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
      <path d="m2 6 4-4" />
      <path d="m18 22 4-4" />
    </>
  ),
  emergency: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
      {ICONS[name]}
    </svg>
  );
}

// BE trả lỗi dạng ProblemDetail: câu giải thích nằm ở `detail`. Với lỗi 400
// (VALIDATION_ERROR), chi tiết từng trường nằm trong `errors`.
function problemMessage(err, fallback) {
  const data = err?.response?.data;
  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat().filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }
  return data?.detail || extractErrorMessage(err, fallback);
}

// Chuyển dữ liệu BE trả về thành giá trị cho form (null -> chuỗi rỗng).
function toForm(data) {
  return {
    fullName: data?.fullName || '',
    phone: data?.phone || '',
    email: data?.email || '',
    birthDate: data?.birthDate || '',
    profileImageUrl: data?.profileImageUrl || '',
    fitnessGoal: data?.fitnessGoal || '',
    emergencyContactName: data?.emergencyContactName || '',
    emergencyContactPhone: data?.emergencyContactPhone || '',
  };
}

// Field — local label-wrapper. Plain component (no forwardRef). Every
// RHF `register()` call in this file is spread directly onto the child
// <input> / <textarea>, so the `ref` reaches the real DOM control
// without any wrapper forwarding. The wrapper just renders the label,
// the required-star, the "Sắp ra mắt" badge, and the children.
function Field({ id, label, required, soon, wide, children }) {
  return (
    <div
      className={`scms-mp-field${wide ? ' wide' : ''}${soon ? ' soon' : ''}`}
    >
      <label htmlFor={id}>
        <span>
          {label}
          {required ? <span className="req"> *</span> : null}
        </span>
        {soon ? <span className="scms-mp-soontag">Sắp ra mắt</span> : null}
      </label>
      {children}
    </div>
  );
}

function SectionHead({ icon, title, chip, chipRequired }) {
  return (
    <div className="scms-mp-card-head">
      <div className="scms-mp-headrow">
        <span className="scms-mp-headicon">
          <Icon name={icon} />
        </span>
        <h2>{title}</h2>
      </div>
      {chip ? (
        <span className={`scms-mp-chip${chipRequired ? ' req' : ''}`}>
          {chip}
        </span>
      ) : null}
    </div>
  );
}

// ----- Trang chính -----

export default function MemberProfilePage() {
  const { user, setUser } = useAuth();
  const { activeMembership, hasActiveMembership, loading: membershipLoading } =
    useMemberArea();

  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(memberProfileSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
      profileImageUrl: '',
      fitnessGoal: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  // `profileImageUrl` is rendered both as the avatar image src and as
  // the value of a hidden text input inside the avatar card. The
  // pre-migration source wrote it into `form.profileImageUrl` from
  // there. We keep the same UX: when the toggle is opened, the user
  // types into a regular text input registered with RHF.
  // useWatch (not watch) is used to avoid the
  // `react(incompatible-library)` lint warning that RHF's plain
  // watch() produces. useWatch MUST be called unconditionally and
  // before any early returns so React's rules-of-hooks hold.
  const profileImageUrlValue = useWatch({
    control,
    name: 'profileImageUrl',
  }) || '';
  const fullNameValue = useWatch({ control, name: 'fullName' }) || '';
  const fitnessGoalValue = useWatch({ control, name: 'fitnessGoal' }) || '';

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        const next = toForm(data);
        setOriginal(next);
        reset(next);
      })
      .catch((err) => {
        if (!cancelled) setServerError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reset]);

  // buildPatch — diff against `original`. Preserved byte-for-byte from
  // the pre-migration source. RHF owns the form values; this function
  // builds the wire payload from the parsed `data` argument and the
  // `original` snapshot kept in state.
  function buildPatch(data) {
    const patch = {};

    const fullName = (data.fullName || '').trim();
    if (fullName !== (original?.fullName || '')) patch.fullName = fullName;

    const phone = normalizePhone(data.phone || '');
    if (phone !== (original?.phone || '')) patch.phone = phone;

    const email = (data.email || '').trim().toLowerCase();
    if (email !== (original?.email || '').toLowerCase()) {
      patch.email = email;
    }

    if (data.birthDate !== (original?.birthDate || '')) {
      patch.birthDate = data.birthDate;
    }

    // Trường tùy chọn: chuỗi rỗng -> gửi null để xóa giá trị.
    const image = (data.profileImageUrl || '').trim();
    if (image !== (original?.profileImageUrl || '')) {
      patch.profileImageUrl = image || null;
    }

    const goal = (data.fitnessGoal || '').trim();
    if (goal !== (original?.fitnessGoal || '')) {
      patch.fitnessGoal = goal || null;
    }

    const ecName = (data.emergencyContactName || '').trim();
    if (ecName !== (original?.emergencyContactName || '')) {
      patch.emergencyContactName = ecName || null;
    }
    const ecPhone = (data.emergencyContactPhone || '').trim();
    const ecPhoneNorm = ecPhone ? normalizePhone(ecPhone) : '';
    if (ecPhoneNorm !== (original?.emergencyContactPhone || '')) {
      patch.emergencyContactPhone = ecPhoneNorm || null;
    }
    return patch;
  }

  function resetForm() {
    if (original) reset(original);
    setSuccess(false);
    setServerError(null);
    setShowImageInput(false);
    setImageBroken(false);
  }

  async function onSubmit(data) {
    setSuccess(false);
    setServerError(null);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setSuccess(true);
      return;
    }
    try {
      const updated = await updateMyProfile(patch);
      // Đồng bộ AuthContext để tên ở header và Dashboard cập nhật theo.
      setUser({ ...(user || {}), ...(updated || {}) });
      const next = toForm(updated);
      setOriginal(next);
      reset(next);
      setShowImageInput(false);
      setSuccess(true);
    } catch (err) {
      // Shared helper for per-field errors. Allowlist matches the
      // editable fields this page renders. EMAIL_ALREADY_EXISTS /
      // PHONE_ALREADY_EXISTS codes map inline when their fields are
      // allowed. Unknown / non-field failures surface in the global
      // ErrorAlert via the !handled branch below.
      const handled = applyServerErrors(err, setError, {
        fields: [
          'fullName',
          'phone',
          'email',
          'birthDate',
          'profileImageUrl',
          'fitnessGoal',
          'emergencyContactName',
          'emergencyContactPhone',
        ],
      });
      if (!handled) {
        // Page-local global error rendering (preserves the original
        // ErrorAlert behavior, which displays BE-provided detail).
        setServerError({ message: problemMessage(err, 'Không lưu được hồ sơ.') });
      }
    }
  }

  if (loading) {
    return (
      <div className="scms-mp-center">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  // Chữ cái đầu của tên, dùng khi chưa có ảnh.
  const initial = (fullNameValue.trim().split(/\s+/).pop() || '?')
    .charAt(0)
    .toUpperCase();
  const showImage = profileImageUrlValue.trim() && !imageBroken;

  const planCode =
    activeMembership?.plan_code_snapshot || activeMembership?.planCode || '';
  let tierText = 'Chưa đăng ký gói tập';
  if (membershipLoading) tierText = 'Đang tải...';
  else if (hasActiveMembership) tierText = `Gói ${planCode}`.trim();

  return (
    <form className="scms-mp" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="scms-mp-top">
        <div>
          <MemberBreadcrumb current="Hồ sơ cá nhân" />
          <h1 className="scms-mp-title">Hồ sơ cá nhân</h1>
        </div>
        <span className={`scms-mp-badge${hasActiveMembership ? ' on' : ''}`}>
          <span className="scms-mp-badge-dot" aria-hidden="true"></span>
          {hasActiveMembership ? `${tierText} đang hoạt động` : 'Chưa đăng ký gói tập'}
        </span>
      </div>

      {!membershipLoading && !hasActiveMembership ? (
        <div className="scms-mp-banner">
          <div className="scms-mp-banner-main">
            <div className="scms-mp-banner-icon">
              <Icon name="info" size={22} />
            </div>
            <div>
              <strong>Tài khoản chưa có gói tập kích hoạt</strong>
              <span className="text">
                Bạn chưa đăng ký gói tập nào. Hãy chọn gói tập phù hợp để bắt
                đầu sử dụng đầy đủ tiện ích và dịch vụ tại SCMS!
              </span>
            </div>
          </div>
          <Link to="/member/dashboard" className="scms-mp-btn-red">
            Xem các gói tập <Icon name="arrow" size={16} />
          </Link>
        </div>
      ) : null}

      <div className="scms-mp-grid">
        {/* ===== Cột trái: ảnh, định danh ===== */}
        <div className="scms-mp-col">
          <div className="scms-mp-card">
            <div className="scms-mp-avatar-wrap">
              <div className="scms-mp-avatar">
                {showImage ? (
                  <img
                    src={profileImageUrlValue.trim()}
                    alt={`Ảnh đại diện ${fullNameValue}`}
                    onError={() => setImageBroken(true)}
                  />
                ) : (
                  initial
                )}
              </div>
              <div>
                <div className="scms-mp-avatar-name">{fullNameValue || '—'}</div>
                <div className={`scms-mp-avatar-sub${hasActiveMembership ? ' on' : ''}`}>
                  {hasActiveMembership
                    ? `Hội viên • ${tierText}`
                    : 'Hội viên mới • Chưa đăng ký gói'}
                </div>
              </div>

              <button
                type="button"
                className="scms-mp-btn-soft"
                onClick={() => setShowImageInput((s) => !s)}
              >
                <Icon name="upload" />
                Tải ảnh mới
              </button>

              {showImageInput ? (
                <div style={{ width: '100%' }}>
                  <input
                    className="scms-mp-input"
                    {...register('profileImageUrl')}
                    onInput={() => setImageBroken(false)}
                    placeholder="Dán đường dẫn ảnh (https://...)"
                    aria-label="Đường dẫn ảnh đại diện"
                    aria-invalid={Boolean(errors.profileImageUrl)}
                  />
                  {errors.profileImageUrl ? (
                    <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                      {errors.profileImageUrl.message}
                    </div>
                  ) : (
                    <div className="scms-mp-hint" style={{ marginTop: 6 }}>
                      Bấm &quot;Lưu thay đổi hồ sơ&quot; để lưu ảnh. Tải ảnh trực
                      tiếp từ máy: <strong>Sắp ra mắt</strong>.
                    </div>
                  )}
                </div>
              ) : (
                <span className="scms-mp-hint">
                  Hiện hỗ trợ ảnh qua đường dẫn (URL). Tải tệp từ máy: Sắp ra mắt.
                </span>
              )}
            </div>
          </div>

          <div className="scms-mp-card">
            <div className="scms-mp-card-head">
              <span className="scms-mp-label-small">Định danh Thẻ SCMS</span>
              <span style={{ color: '#dc2626', display: 'flex' }}>
                <Icon name="badge" />
              </span>
            </div>

            {/* BR-ACC-27 / BR-VAL-ACC-11: Member ID do hệ thống sinh, không sửa được. */}
            <div className="scms-mp-memberid">
              <small>
                Mã hội viên (Member ID)
                <Icon name="lock" size={16} />
              </small>
              <strong>{user?.memberId || '—'}</strong>
            </div>

            <div className="scms-mp-rows">
              <div className="scms-mp-row">
                <span className="k">Ngày gia nhập</span>
                {/* Ngày đăng ký tài khoản thành công. TODO: BE chưa trả
                    `createdAt` trong GET /members/me/profile; khi có thì ô
                    này tự hiện ngày, hiện tại hiện "Sắp ra mắt". */}
                {user?.createdAt ? (
                  <span className="v">{formatDate(user.createdAt)}</span>
                ) : (
                  <span className="v scms-mp-soontag">Sắp ra mắt</span>
                )}
              </div>
              <div className="scms-mp-row">
                <span className="k">Trạng thái tài khoản</span>
                <span
                  className={`scms-mp-pill${user?.status === 'SUSPENDED' ? ' warn' : ''}`}
                >
                  {user?.status === 'SUSPENDED' ? 'Bị đình chỉ' : 'Đang hoạt động'}
                </span>
              </div>
              <div className="scms-mp-row">
                <span className="k">Hạng hội viên</span>
                <span className="v">
                  {tierText}
                  {!membershipLoading && !hasActiveMembership ? (
                    <Link to="/member/dashboard">Khám phá gói tập ngay →</Link>
                  ) : null}
                </span>
              </div>
            </div>

            <div className="scms-mp-tip">
              <Icon name="tip" />
              <span>
                Hội viên xuất trình mã Member ID hoặc đọc Số điện thoại cá nhân
                tại quầy để Lễ tân tra cứu hồ sơ.
              </span>
            </div>
          </div>
        </div>

        {/* ===== Cột phải: các mục thông tin ===== */}
        <div className="scms-mp-col">
          <ErrorAlert
            error={serverError}
            title="Không lưu được hồ sơ"
            onClose={() => setServerError(null)}
          />
          {success ? (
            <Alert
              variant="success"
              dismissible
              onClose={() => setSuccess(false)}
              className="mb-0"
            >
              Đã lưu thay đổi hồ sơ.
            </Alert>
          ) : null}

          {/* Mục A: thông tin tài khoản */}
          <div className="scms-mp-card wide">
            <SectionHead
              icon="user"
              title="Thông tin tài khoản"
              chip="* Bắt buộc"
              chipRequired
            />
            <div className="scms-mp-fields">
              <Field id="mp-fullName" label="Họ và tên đầy đủ" required wide>
                <input
                  id="mp-fullName"
                  className="scms-mp-input"
                  {...register('fullName')}
                  placeholder="Nhập họ và tên..."
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                />
                {errors.fullName ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.fullName.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-phone" label="Số điện thoại" required>
                <input
                  id="mp-phone"
                  className="scms-mp-input"
                  type="tel"
                  {...register('phone')}
                  placeholder="09xxxxxxxx"
                  inputMode="numeric"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.phone.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-email" label="Địa chỉ Email" required>
                <input
                  id="mp-email"
                  className="scms-mp-input"
                  type="email"
                  {...register('email')}
                  placeholder="ten@mien.vn"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.email.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-birthDate" label="Ngày sinh" required>
                <input
                  id="mp-birthDate"
                  className="scms-mp-input"
                  type="date"
                  {...register('birthDate')}
                  autoComplete="bday"
                  aria-invalid={Boolean(errors.birthDate)}
                />
                {errors.birthDate ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.birthDate.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-gender" label="Giới tính" soon>
                <div className="scms-mp-radios">
                  <label className="scms-mp-radio">
                    <input type="radio" name="gender" disabled /> Nam
                  </label>
                  <label className="scms-mp-radio">
                    <input type="radio" name="gender" disabled /> Nữ
                  </label>
                </div>
              </Field>
              <Field id="mp-address" label="Địa chỉ cư trú hiện tại" soon wide>
                <input
                  id="mp-address"
                  className="scms-mp-input"
                  placeholder="Địa chỉ đường, phường/xã, quận/huyện..."
                  disabled
                />
              </Field>
            </div>
          </div>

          {/* Mục đổi mật khẩu: dẫn tới trang riêng (US04) */}
          <div className="scms-mp-card wide">
            <SectionHead icon="key" title="Đổi mật khẩu" />
            <div className="scms-mp-pw">
              <p>
                Đổi mật khẩu đăng nhập. Sau khi đổi thành công, bạn sẽ được đăng
                xuất và cần đăng nhập lại.
              </p>
              <Link to="/member/profile/password" className="scms-mp-btn-dark">
                <Icon name="key" />
                Đổi mật khẩu
              </Link>
            </div>
          </div>

          {/* Mục B: mục tiêu thể chất (BR-ACC-09: tùy chọn) */}
          <div className="scms-mp-card wide">
            <SectionHead icon="exercise" title="Mục tiêu thể chất & Rèn luyện" chip="Tùy chọn" />
            <div className="scms-mp-field">
              <label htmlFor="mp-goal">
                <span>Mục tiêu rèn luyện trọng tâm</span>
              </label>
              <div className="scms-mp-chips" style={{ marginBottom: 12 }}>
                {GOAL_PRESETS.map((goal) => {
                  const active = (fitnessGoalValue || '').trim() === goal;
                  return (
                    <button
                      key={goal}
                      type="button"
                      className={`scms-mp-goal${active ? ' active' : ''}`}
                      onClick={() => setValue('fitnessGoal', goal, { shouldValidate: true })}
                    >
                      {active ? <Icon name="check" size={14} /> : null}
                      {goal}
                    </button>
                  );
                })}
              </div>
              <textarea
                id="mp-goal"
                className="scms-mp-input"
                rows={3}
                {...register('fitnessGoal')}
                placeholder="Chọn nhanh ở trên hoặc tự viết mục tiêu của bạn..."
                aria-invalid={Boolean(errors.fitnessGoal)}
              />
              {errors.fitnessGoal ? (
                <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                  {errors.fitnessGoal.message}
                </div>
              ) : null}
            </div>
            <Field id="mp-injury" label="Ghi chú thể chất & Tiền sử chấn thương" soon>
              <textarea
                id="mp-injury"
                className="scms-mp-input"
                rows={2}
                placeholder="Ví dụ: Đã từng mổ dây chằng chéo trước, đau lưng dưới nhẹ..."
                disabled
              />
            </Field>
          </div>

          {/* Mục C: liên hệ khẩn cấp (BR-ACC-09: tùy chọn, tên + SĐT đi cùng nhau) */}
          <div className="scms-mp-card wide">
            <SectionHead icon="emergency" title="Thông tin liên hệ khẩn cấp" chip="Tùy chọn" />
            <div className="scms-mp-fields">
              <Field id="mp-ecName" label="Họ tên người liên hệ">
                <input
                  id="mp-ecName"
                  className="scms-mp-input"
                  {...register('emergencyContactName')}
                  placeholder="Họ và tên người thân..."
                  aria-invalid={Boolean(errors.emergencyContactName)}
                />
                {errors.emergencyContactName ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.emergencyContactName.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-ecRelation" label="Mối quan hệ" soon>
                <select id="mp-ecRelation" className="scms-mp-input" disabled>
                  <option>Chọn mối quan hệ</option>
                </select>
              </Field>
              <Field id="mp-ecPhone" label="Số điện thoại khẩn cấp">
                <input
                  id="mp-ecPhone"
                  className="scms-mp-input"
                  type="tel"
                  {...register('emergencyContactPhone')}
                  placeholder="09xxxxxxxx"
                  inputMode="numeric"
                  aria-invalid={Boolean(errors.emergencyContactPhone)}
                />
                {errors.emergencyContactPhone ? (
                  <div className="scms-mp-hint" style={{ marginTop: 6, color: '#dc2626' }}>
                    {errors.emergencyContactPhone.message}
                  </div>
                ) : null}
              </Field>
              <Field id="mp-ecTime" label="Ghi chú khung giờ liên hệ" soon>
                <input
                  id="mp-ecTime"
                  className="scms-mp-input"
                  placeholder="Khung giờ gọi..."
                  disabled
                />
              </Field>
            </div>
          </div>

          <div className="scms-mp-actions">
            <button
              type="button"
              className="scms-mp-btn-cancel"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Hủy bỏ
            </button>
            <button type="submit" className="scms-mp-btn-save" disabled={isSubmitting}>
              <Icon name="save" />
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
