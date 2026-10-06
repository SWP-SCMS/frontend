// Manager – Edit Member account (US06).
//
// BR-ACC-05: role is fixed for the account's lifetime — there is NO role
// field on this form. Only fullName / phone / email / birthDate are
// patchable (the backend rejects anything else via JsonAnySetter).
// Status changes (ACTIVE <-> SUSPENDED) happen on the detail page, not
// here.
//
// PATCH semantics are "omitted = unchanged". We therefore send only the
// keys that actually changed vs. the original fetched value.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getMemberAccount,
  updateMemberAccount,
} from '../../../services/memberAccountService';
import { ROLE_LABELS, ROLES } from '../../../constants';
import {
  formatDate,
  isValidPhone,
  normalizePhone,
} from '../../../utils';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  birthDate: '',
};

export default function MemberAccountEditPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [original, setOriginal] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMemberAccount(accountId);
      const next = {
        fullName: data?.fullName || '',
        phone: data?.phone || '',
        email: data?.email || '',
        birthDate: data?.birthDate || '',
      };
      setAccount(data);
      setForm(next);
      setOriginal(next);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess(false);
  }

  function reset() {
    setForm(original);
    setSuccess(false);
    setError(null);
  }

  function buildPatch() {
    const patch = {};
    if (form.fullName.trim() !== (original.fullName || '')) {
      patch.fullName = form.fullName.trim();
    }
    const normalizedNewPhone = form.phone ? normalizePhone(form.phone) : null;
    const normalizedOldPhone = original.phone ? normalizePhone(original.phone) : null;
    if (form.phone && normalizedNewPhone !== normalizedOldPhone) {
      patch.phone = normalizedNewPhone;
    }
    if (form.email.trim().toLowerCase() !== (original.email || '').toLowerCase()) {
      patch.email = form.email.trim().toLowerCase();
    }
    if (form.birthDate !== (original.birthDate || '')) {
      patch.birthDate = form.birthDate;
    }
    return patch;
  }

  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.';
    if (form.fullName.trim().length > 200) {
      return 'Họ và tên không được vượt quá 200 ký tự.';
    }
    if (form.phone && !isValidPhone(form.phone)) {
      return 'Số điện thoại phải có đúng 10 chữ số và bắt đầu bằng 0.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Email không hợp lệ.';
    }
    if (!form.birthDate) return 'Vui lòng nhập ngày sinh.';
    if (form.birthDate > new Date().toISOString().slice(0, 10)) {
      return 'Ngày sinh không được là ngày trong tương lai.';
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
      setError(null);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMemberAccount(accountId, patch);
      const next = {
        fullName: updated?.fullName || '',
        phone: updated?.phone || '',
        email: updated?.email || '',
        birthDate: updated?.birthDate || '',
      };
      setAccount(updated);
      setForm(next);
      setOriginal(next);
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

  if (error && !account) {
    return (
      <div>
        <Link to="/manager/members" className="small text-decoration-none">
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được hội viên"
        />
      </div>
    );
  }

  if (!account) return null;

  return (
    <div>
      <Link
        to={`/manager/members/${account.accountId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa hội viên</h1>
      <p className="text-muted mb-4">
        {account.fullName || '—'} · {ROLE_LABELS[ROLES.MEMBER]} · Account ID{' '}
        <code className="small">{account.accountId}</code>
      </p>

      <ErrorAlert
        error={error}
        title="Không lưu được thay đổi"
        onClose={() => setError(null)}
      />
      {success ? (
        <div className="alert alert-success py-2">Đã lưu thay đổi.</div>
      ) : null}

      <Form onSubmit={handleSubmit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="edit-fullName">
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
            <Form.Group controlId="edit-phone">
              <Form.Label>Số điện thoại *</Form.Label>
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
            <Form.Group controlId="edit-email">
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
            <Form.Group controlId="edit-birthDate">
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

        <fieldset className="mt-4">
          <legend className="h6 text-uppercase text-muted">
            Trường không thể chỉnh sửa
          </legend>
          <Row className="g-3">
            <Col md={6}>
              <div className="text-muted small">Vai trò</div>
              <div className="fw-semibold">{ROLE_LABELS[ROLES.MEMBER]}</div>
            </Col>
            <Col md={6}>
              <div className="text-muted small">Trạng thái hiện tại</div>
              <div className="fw-semibold">{account.status || '—'}</div>
            </Col>
          </Row>
          <p className="small text-muted mt-2 mb-0">
            Theo BR-ACC-05 / BR-LIM-02: vai trò cố định suốt vòng đời tài khoản. Để
            thay đổi trạng thái (ACTIVE ↔ SUSPENDED), dùng nút trên trang chi tiết.
          </p>
          <p className="small text-muted mt-1 mb-0">
            Ngày tạo: {formatDate(account.createdAt) || '—'}
          </p>
        </fieldset>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang lưu…
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={reset}
            disabled={saving}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => navigate(`/manager/members/${account.accountId}`)}
            disabled={saving}
          >
            Quay lại chi tiết
          </Button>
        </div>
      </Form>
    </div>
  );
}