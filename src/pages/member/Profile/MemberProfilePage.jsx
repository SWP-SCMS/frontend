// Member self-profile editor.
//
// PATCH /api/v1/members/me/profile
//   - omitted field -> unchanged
//   - null on optional field -> clear
//   - duplicate phone/email -> 409 (handled by backend, surfaced as error)
//
// Read-only fields shown but disabled: accountId, memberId, role, status.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Button, Row, Col, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { getMyProfile, updateMyProfile } from '../../../services/memberService';
import { useAuth } from '../../../context/useAuth';
import { formatDate, isValidPhone, normalizePhone } from '../../../utils';
import { ROLE_LABELS } from '../../../constants';

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

export default function MemberProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [original, setOriginal] = useState(emptyForm);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        const next = {
          fullName: data?.fullName || '',
          phone: data?.phone || '',
          email: data?.email || '',
          birthDate: data?.birthDate || '',
          profileImageUrl: data?.profileImageUrl || '',
          fitnessGoal: data?.fitnessGoal || '',
          emergencyContactName: data?.emergencyContactName || '',
          emergencyContactPhone: data?.emergencyContactPhone || '',
        };
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

  function resetForm() {
    setForm(original);
    setSuccess(false);
    setError(null);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess(false);
  }

  function buildPatch() {
    const patch = {};
    const setIf = (key, value) => {
      if (value && value !== user?.[key]) patch[key] = value;
    };

    setIf('fullName', form.fullName.trim());
    if (form.phone && form.phone !== user?.phone) {
      patch.phone = normalizePhone(form.phone);
    }
    setIf('email', form.email.trim().toLowerCase());
    if (form.birthDate && form.birthDate !== user?.birthDate) {
      patch.birthDate = form.birthDate;
    }
    if ((form.profileImageUrl || null) !== (user?.profileImageUrl || null)) {
      patch.profileImageUrl = form.profileImageUrl.trim() || null;
    }
    if ((form.fitnessGoal || null) !== (user?.fitnessGoal || null)) {
      patch.fitnessGoal = form.fitnessGoal.trim() || null;
    }

    const ecName = form.emergencyContactName.trim();
    const ecPhone = form.emergencyContactPhone.trim();
    const ecNameWas = user?.emergencyContactName || null;
    const ecPhoneWas = user?.emergencyContactPhone || null;

    if (ecName !== (ecNameWas || '')) patch.emergencyContactName = ecName || null;
    if (ecPhone !== (ecPhoneWas || '')) {
      patch.emergencyContactPhone = ecPhone ? normalizePhone(ecPhone) : null;
    }

    return patch;
  }

  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ tên.';
    if (!isValidPhone(form.phone)) return 'Số điện thoại không hợp lệ.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email không hợp lệ.';
    if (!form.birthDate) return 'Vui lòng nhập ngày sinh.';

    const ecName = form.emergencyContactName.trim();
    const ecPhone = form.emergencyContactPhone.trim();
    if ((ecName && !ecPhone) || (!ecName && ecPhone)) {
      return 'Liên hệ khẩn cấp phải nhập cả họ tên và số điện thoại.';
    }
    if (ecPhone && !isValidPhone(ecPhone)) {
      return 'Số điện thoại liên hệ khẩn cấp không hợp lệ.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setSuccess(true);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMyProfile(patch);
      // Keep AuthContext in sync so the header dropdown reflects changes.
      const merged = { ...(user || {}), ...(updated || {}) };
      setUser(merged);
      // Reset the "original" snapshot so subsequent cancels go back to the
      // server-confirmed values.
      setOriginal({
        fullName: merged.fullName || '',
        phone: merged.phone || '',
        email: merged.email || '',
        birthDate: merged.birthDate || '',
        profileImageUrl: merged.profileImageUrl || '',
        fitnessGoal: merged.fitnessGoal || '',
        emergencyContactName: merged.emergencyContactName || '',
        emergencyContactPhone: merged.emergencyContactPhone || '',
      });
      setSuccess(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h1 className="h3 fw-bold mb-0">Hồ sơ cá nhân</h1>
        <Link to="/member/profile/password" className="small">
          Đổi mật khẩu
        </Link>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="text-muted small">Mã hội viên</div>
          <div className="fw-semibold">{user?.memberId || '—'}</div>
        </div>
        <div className="col-md-3">
          <div className="text-muted small">Vai trò</div>
          <div className="fw-semibold">{ROLE_LABELS[user?.role] || '—'}</div>
        </div>
        <div className="col-md-3">
          <div className="text-muted small">Trạng thái</div>
          <div className="fw-semibold">{user?.status || '—'}</div>
        </div>
        <div className="col-md-3">
          <div className="text-muted small">Ngày tạo</div>
          <div className="fw-semibold">{formatDate(user?.createdAt)}</div>
        </div>
      </div>

      <ErrorAlert
        error={error}
        title="Không lưu được hồ sơ"
        onClose={() => setError(null)}
      />
      {success ? (
        <div className="alert alert-success py-2">Đã lưu thay đổi.</div>
      ) : null}

      <Form onSubmit={handleSubmit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="profile-fullName">
              <Form.Label>Họ và tên</Form.Label>
              <Form.Control
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="profile-phone">
              <Form.Label>Số điện thoại</Form.Label>
              <Form.Control
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                inputMode="numeric"
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="profile-email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="profile-birthDate">
              <Form.Label>Ngày sinh</Form.Label>
              <Form.Control
                type="date"
                value={form.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="profile-image">
          <Form.Label>Ảnh đại diện (URL)</Form.Label>
          <Form.Control
            value={form.profileImageUrl}
            onChange={(e) => update('profileImageUrl', e.target.value)}
            placeholder="https://..."
          />
          <Form.Text className="text-muted">
            Upload ảnh sẽ dùng API riêng — tích hợp sau.
          </Form.Text>
        </Form.Group>

        <Form.Group className="mt-3" controlId="profile-goal">
          <Form.Label>Mục tiêu tập luyện</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={form.fitnessGoal}
            onChange={(e) => update('fitnessGoal', e.target.value)}
          />
        </Form.Group>

        <fieldset className="mt-3">
          <legend className="h6 text-muted small text-uppercase">
            Liên hệ khẩn cấp
          </legend>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="profile-ec-name">
                <Form.Label>Họ tên</Form.Label>
                <Form.Control
                  value={form.emergencyContactName}
                  onChange={(e) =>
                    update('emergencyContactName', e.target.value)
                  }
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="profile-ec-phone">
                <Form.Label>Số điện thoại</Form.Label>
                <Form.Control
                  value={form.emergencyContactPhone}
                  onChange={(e) =>
                    update('emergencyContactPhone', e.target.value)
                  }
                  inputMode="numeric"
                />
              </Form.Group>
            </Col>
          </Row>
        </fieldset>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={resetForm}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
