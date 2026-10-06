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
// hệ, ghi chú chấn thương, chỉ số InBody, tải ảnh từ máy, ngày gia nhập) được
// giữ lại trên giao diện ở dạng làm mờ, ghi "Sắp ra mắt".

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { useMemberArea } from '../../../components/layout/MemberAreaContext';
import { getMyProfile, updateMyProfile } from '../../../services/memberService';
import { useAuth } from '../../../context/useAuth';
import { extractErrorMessage, isValidPhone, normalizePhone } from '../../../utils';
import './MemberProfilePage.css';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  birthDate: '',
  profileImageUrl: '',
  fitnessGoal: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

// Các mục tiêu chọn nhanh: bấm sẽ điền chữ vào ô "Mục tiêu tập luyện".
const GOAL_PRESETS = [
  'Tăng cơ - Giảm mỡ',
  'Cải thiện sức bền Cardio',
  'Tăng cường sức mạnh cơ bắp',
  'Rèn luyện thói quen vận động',
];

// ----- Icon SVG vẽ trực tiếp (không cài thư viện icon) -----

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
  chevron: <path d="m9 6 6 6-6 6" />,
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

// ----- Hàm hỗ trợ -----

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

// Một ô nhập: nhãn + ô. `soon` = chưa có API -> làm mờ, ghi "Sắp ra mắt".
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

  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        const next = toForm(data);
        setForm(next);
        setOriginal(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess(false);
  }

  function resetForm() {
    setForm(original);
    setSuccess(false);
    setError(null);
    setShowImageInput(false);
    setImageBroken(false);
  }

  // Chỉ gửi những trường đã đổi so với dữ liệu BE (original).
  function buildPatch() {
    const patch = {};

    const fullName = form.fullName.trim();
    if (fullName !== original.fullName) patch.fullName = fullName;

    const phone = normalizePhone(form.phone);
    if (phone !== original.phone) patch.phone = phone;

    const email = form.email.trim().toLowerCase();
    if (email !== original.email) patch.email = email;

    if (form.birthDate !== original.birthDate) patch.birthDate = form.birthDate;

    // Trường tùy chọn: chuỗi rỗng -> gửi null để xóa giá trị.
    const image = form.profileImageUrl.trim();
    if (image !== original.profileImageUrl) patch.profileImageUrl = image || null;

    const goal = form.fitnessGoal.trim();
    if (goal !== original.fitnessGoal) patch.fitnessGoal = goal || null;

    const ecName = form.emergencyContactName.trim();
    if (ecName !== original.emergencyContactName) {
      patch.emergencyContactName = ecName || null;
    }
    const ecPhone = form.emergencyContactPhone.trim();
    const ecPhoneNorm = ecPhone ? normalizePhone(ecPhone) : '';
    if (ecPhoneNorm !== original.emergencyContactPhone) {
      patch.emergencyContactPhone = ecPhoneNorm || null;
    }
    return patch;
  }

  function validate() {
    // BR-VAL-ACC-09: họ tên, SĐT, email, ngày sinh không được để trống.
    if (!form.fullName.trim()) return 'Vui lòng nhập họ tên.';
    // BR-VAL-ACC-06: SĐT và email phải đúng định dạng.
    if (!isValidPhone(form.phone))
      return 'Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return 'Email không hợp lệ.';
    // BR-VAL-ACC-06: ngày sinh không được ở tương lai.
    if (!form.birthDate) return 'Vui lòng nhập ngày sinh.';
    if (form.birthDate > new Date().toISOString().slice(0, 10))
      return 'Ngày sinh không được ở tương lai.';

    // BR-ACC-09: liên hệ khẩn cấp là tùy chọn, nhưng tên và SĐT đi cùng nhau.
    const ecName = form.emergencyContactName.trim();
    const ecPhone = form.emergencyContactPhone.trim();
    if ((ecName && !ecPhone) || (!ecName && ecPhone))
      return 'Liên hệ khẩn cấp phải nhập cả họ tên và số điện thoại.';
    if (ecPhone && !isValidPhone(ecPhone))
      return 'Số điện thoại liên hệ khẩn cấp không hợp lệ.';

    // Ảnh hồ sơ là URL (BR-ACC-11), chưa hỗ trợ tải file.
    const image = form.profileImageUrl.trim();
    if (image && !/^https?:\/\/\S+$/i.test(image))
      return 'Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccess(false);
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setError(null);
      setSuccess(true);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMyProfile(patch);
      // Đồng bộ AuthContext để tên ở header và Dashboard cập nhật theo.
      setUser({ ...(user || {}), ...(updated || {}) });
      const next = toForm(updated);
      setForm(next);
      setOriginal(next);
      setShowImageInput(false);
      setSuccess(true);
    } catch (err) {
      // Luôn hiển thị lỗi BE trả về (vd: SĐT/email đã được dùng).
      setError({ message: problemMessage(err, 'Không lưu được hồ sơ.') });
    } finally {
      setSaving(false);
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
  const initial = (form.fullName.trim().split(/\s+/).pop() || '?')
    .charAt(0)
    .toUpperCase();
  const showImage = form.profileImageUrl.trim() && !imageBroken;

  const planCode =
    activeMembership?.plan_code_snapshot || activeMembership?.planCode || '';
  let tierText = 'Chưa đăng ký gói tập';
  if (membershipLoading) tierText = 'Đang tải...';
  else if (hasActiveMembership) tierText = `Gói ${planCode}`.trim();

  return (
    <form className="scms-mp" onSubmit={handleSubmit} noValidate>
      <div className="scms-mp-top">
        <div>
          <div className="scms-mp-crumb">
            <span>Trang chủ</span>
            <Icon name="chevron" size={14} />
            <span>Hội viên</span>
            <Icon name="chevron" size={14} />
            <strong>Hồ sơ cá nhân</strong>
          </div>
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
        {/* ===== Cột trái: ảnh, định danh, InBody ===== */}
        <div className="scms-mp-col">
          <div className="scms-mp-card">
            <div className="scms-mp-avatar-wrap">
              <div className="scms-mp-avatar">
                {showImage ? (
                  <img
                    src={form.profileImageUrl.trim()}
                    alt={`Ảnh đại diện ${form.fullName}`}
                    onError={() => setImageBroken(true)}
                  />
                ) : (
                  initial
                )}
              </div>
              <div>
                <div className="scms-mp-avatar-name">{form.fullName || '—'}</div>
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
                    value={form.profileImageUrl}
                    onChange={(e) => {
                      update('profileImageUrl', e.target.value);
                      setImageBroken(false);
                    }}
                    placeholder="Dán đường dẫn ảnh (https://...)"
                    aria-label="Đường dẫn ảnh đại diện"
                  />
                  <div className="scms-mp-hint" style={{ marginTop: 6 }}>
                    Bấm &quot;Lưu thay đổi hồ sơ&quot; để lưu ảnh. Tải ảnh trực
                    tiếp từ máy: <strong>Sắp ra mắt</strong>.
                  </div>
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
                <span className="v scms-mp-soontag">Sắp ra mắt</span>
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

          <div className="scms-mp-card soon">
            <div className="scms-mp-card-head">
              <span className="scms-mp-label-small">Chỉ số thể lực InBody</span>
              <span className="scms-mp-soontag">Sắp ra mắt</span>
            </div>
            <div className="scms-mp-metrics">
              <div className="scms-mp-metric">
                <small>Chiều cao</small>
                <strong>— cm</strong>
              </div>
              <div className="scms-mp-metric">
                <small>Cân nặng</small>
                <strong>— kg</strong>
              </div>
              <div className="scms-mp-metric">
                <small>Mỡ Body</small>
                <strong>— %</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Cột phải: các mục thông tin ===== */}
        <div className="scms-mp-col">
          <ErrorAlert
            error={error}
            title="Không lưu được hồ sơ"
            onClose={() => setError(null)}
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
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  placeholder="Nhập họ và tên..."
                  autoComplete="name"
                />
              </Field>
              <Field id="mp-phone" label="Số điện thoại" required>
                <input
                  id="mp-phone"
                  className="scms-mp-input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="09xxxxxxxx"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </Field>
              <Field id="mp-email" label="Địa chỉ Email" required>
                <input
                  id="mp-email"
                  className="scms-mp-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="ten@mien.vn"
                  autoComplete="email"
                />
              </Field>
              <Field id="mp-birthDate" label="Ngày sinh" required>
                <input
                  id="mp-birthDate"
                  className="scms-mp-input"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => update('birthDate', e.target.value)}
                  autoComplete="bday"
                />
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
                  const active = form.fitnessGoal.trim() === goal;
                  return (
                    <button
                      key={goal}
                      type="button"
                      className={`scms-mp-goal${active ? ' active' : ''}`}
                      onClick={() => update('fitnessGoal', goal)}
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
                value={form.fitnessGoal}
                onChange={(e) => update('fitnessGoal', e.target.value)}
                placeholder="Chọn nhanh ở trên hoặc tự viết mục tiêu của bạn..."
              />
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
                  value={form.emergencyContactName}
                  onChange={(e) => update('emergencyContactName', e.target.value)}
                  placeholder="Họ và tên người thân..."
                />
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
                  value={form.emergencyContactPhone}
                  onChange={(e) =>
                    update('emergencyContactPhone', e.target.value)
                  }
                  placeholder="09xxxxxxxx"
                  inputMode="numeric"
                />
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
              disabled={saving}
            >
              Hủy bỏ
            </button>
            <button type="submit" className="scms-mp-btn-save" disabled={saving}>
              <Icon name="save" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi hồ sơ'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
