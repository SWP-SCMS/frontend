// Manager – Create staff/manager account (US08).
//
// Business rules (BR-ACC-03, BR-ACC-04, BR-VAL-ACC-03..09):
//   - Manager creates COACH, RECEPTIONIST or MANAGER.
//   - All of fullName / phone / email / birthDate / role are required.
//   - Role is FIXED for the account's lifetime (BR-SCP-02, BR-LIM-02).
//   - Default password = current phone number (set by backend).
//
// Backend enforces 409 on duplicate email/phone and rejects unknown
// fields via StaffAccountCreateRequest#rejectUnknownField. We only send
// the five documented keys.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { createStaffAccount } from '../../../services/staffAccountService';
import { isValidPhone, normalizePhone } from '../../../utils';
import { ROLE_LABELS, ROLES } from '../../../constants';

const ROLE_OPTIONS = [
  { value: ROLES.COACH, label: ROLE_LABELS[ROLES.COACH] },
  { value: ROLES.RECEPTIONIST, label: ROLE_LABELS[ROLES.RECEPTIONIST] },
  { value: ROLES.MANAGER, label: ROLE_LABELS[ROLES.MANAGER] },
];

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  birthDate: '',
  role: '',
};

export default function StaffAccountCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.';
    if (form.fullName.trim().length > 200) {
      return 'Họ và tên không được vượt quá 200 ký tự.';
    }
    if (!isValidPhone(form.phone)) {
      return 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Email không hợp lệ.';
    }
    if (!form.birthDate) return 'Vui lòng nhập ngày sinh.';
    if (form.birthDate > new Date().toISOString().slice(0, 10)) {
      return 'Ngày sinh không được là ngày trong tương lai.';
    }
    if (!form.role) return 'Vui lòng chọn vai trò.';
    if (!ROLE_OPTIONS.some((o) => o.value === form.role)) {
      return 'Vai trò không hợp lệ.';
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
    setError(null);
    setSubmitting(true);
    try {
      const created = await createStaffAccount({
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        email: form.email.trim().toLowerCase(),
        birthDate: form.birthDate,
        role: form.role,
      });
      navigate(`/manager/staff-accounts/${created.accountId}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        to="/manager/staff-accounts"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo tài khoản nhân viên hoặc quản lý</h1>
      <p className="text-muted mb-4">
        Theo BR-ACC-03: tài khoản mới được tạo ở trạng thái ACTIVE, mật khẩu mặc định là
        số điện thoại đăng ký. Vai trò được gán cố định cho toàn bộ vòng đời tài khoản
        (BR-SCP-02).
      </p>

      <ErrorAlert
        error={error}
        title="Không tạo được tài khoản"
        onClose={() => setError(null)}
      />

      <Form onSubmit={handleSubmit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="create-fullName">
              <Form.Label>Họ và tên *</Form.Label>
              <Form.Control
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
                maxLength={200}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="create-phone">
              <Form.Label>Số điện thoại *</Form.Label>
              <Form.Control
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                inputMode="numeric"
                placeholder="VD: 0901234567"
                required
              />
              <Form.Text className="text-muted">
                Cũng được dùng làm mật khẩu mặc định của tài khoản.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="create-email">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                maxLength={320}
                required
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="create-birthDate">
              <Form.Label>Ngày sinh *</Form.Label>
              <Form.Control
                type="date"
                value={form.birthDate}
                onChange={(e) => update('birthDate', e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="create-role">
          <Form.Label>Vai trò *</Form.Label>
          <Form.Select
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
            required
          >
            <option value="">— Chọn vai trò —</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Vai trò sẽ không thể thay đổi. Để đổi vai trò, hãy chuyển tài khoản sang
            INACTIVE và tạo tài khoản mới.
          </Form.Text>
        </Form.Group>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo tài khoản'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/staff-accounts')}
            disabled={submitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}