// Receptionist – Create a Member at the front desk (US15).
//
// BE: POST /api/v1/reception/members
//     body: { fullName, phone, email, birthDate, profileImageUrl? }
//     -> 201 CreateMemberResponse (no password, no token, no cookie)
//
// Contract details that shape this UI:
//   - All of fullName/phone/email/birthDate are required. birthDate must not
//     be in the future.
//   - The default password is derived server-side from the normalized phone
//     and stored only as a BCrypt hash. It is NEVER returned, so this page
//     must not promise to show it.
//   - 409 EMAIL_ALREADY_EXISTS / PHONE_ALREADY_EXISTS /
//     ACCOUNT_IDENTIFIER_ALREADY_EXISTS for a concurrent create.
//   - additionalProperties: false — we must not send role/status/accountId.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createReceptionMember } from '../../../services/receptionistService';
import { normalizePhone } from '../../../utils';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  email: '',
  birthDate: '',
  profileImageUrl: '',
};

export default function MemberCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [created, setCreated] = useState(null);

  function handleChange(field) {
    return (e) => {
      const { value } = e.target;
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const fullName = form.fullName.trim();
    const phone = normalizePhone(form.phone);
    const email = form.email.trim();
    const birthDate = form.birthDate;

    if (!fullName) {
      setError(new Error('Họ và tên không được để trống.'));
      return;
    }
    if (!phone) {
      setError(new Error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'));
      return;
    }
    if (!email) {
      setError(new Error('Email không được để trống.'));
      return;
    }
    if (!birthDate) {
      setError(new Error('Ngày sinh không được để trống.'));
      return;
    }
    if (birthDate > new Date().toISOString().slice(0, 10)) {
      setError(new Error('Ngày sinh không được nằm trong tương lai.'));
      return;
    }

    const payload = { fullName, phone, email, birthDate };
    if (form.profileImageUrl.trim()) {
      payload.profileImageUrl = form.profileImageUrl.trim();
    }

    setSubmitting(true);
    try {
      const member = await createReceptionMember(payload);
      setCreated(member);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err);
      const code = err?.response?.data?.code;
      if (
        code === 'EMAIL_ALREADY_EXISTS' ||
        code === 'PHONE_ALREADY_EXISTS' ||
        code === 'ACCOUNT_IDENTIFIER_ALREADY_EXISTS'
      ) {
        setNotice(
          code === 'EMAIL_ALREADY_EXISTS'
            ? 'Email này đã được một tài khoản khác sử dụng. Vui lòng nhập email khác.'
            : code === 'PHONE_ALREADY_EXISTS'
              ? 'Số điện thoại này đã được một tài khoản khác sử dụng. Vui lòng nhập số khác.'
              : 'Email hoặc số điện thoại vừa được dùng cho một tài khoản khác. Vui lòng kiểm tra lại.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setCreated(null);
    setForm(EMPTY_FORM);
  }

  if (created) {
    return (
      <div>
        <Alert variant="success">
          <Alert.Heading className="h6 mb-1">Đã tạo hội viên thành công</Alert.Heading>
          <div className="small">
            Mã hội viên <strong>{created.memberId}</strong> · {created.fullName} ·{' '}
            {created.phone}
          </div>
        </Alert>

        <Alert variant="info" className="small">
          Mật khẩu khởi tạo được hệ thống sinh từ số điện thoại và không hiển thị
          trên màn hình này. Hãy thông báo cho hội viên theo quy định của trung tâm,
          hoặc dùng chức năng đặt lại mật khẩu nếu cần.
        </Alert>

        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => navigate(`/reception/orders/new?memberId=${created.memberId}`)}
          >
            Tạo đơn gói tập cho {created.fullName}
          </Button>
          <Button as={Link} to={`/reception/members/${created.memberId}`} variant="outline-danger">
            Xem hồ sơ
          </Button>
          <Button variant="outline-secondary" onClick={startAnother}>
            Tạo hội viên khác
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Đăng ký hội viên</h1>
        <p className="text-muted mb-0">
          Tạo tài khoản hội viên mới tại quầy lễ tân.
        </p>
      </header>

      {notice ? (
        <Alert variant="warning" dismissible onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      <ErrorAlert
        error={error}
        title="Không tạo được hội viên"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      <Form onSubmit={handleSubmit}>
        <Row className="g-3">
          <Col lg={7}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted mb-1">Họ và tên *</Form.Label>
                  <Form.Control
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                    maxLength={200}
                    required
                  />
                </Form.Group>

                <Row className="g-3">
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Số điện thoại *</Form.Label>
                      <Form.Control
                        value={form.phone}
                        onChange={handleChange('phone')}
                        inputMode="numeric"
                        required
                      />
                      <Form.Text className="text-muted">
                        Dùng làm định danh đăng nhập và nguồn sinh mật khẩu khởi tạo.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Email *</Form.Label>
                      <Form.Control
                        type="email"
                        value={form.email}
                        onChange={handleChange('email')}
                        maxLength={320}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ngày sinh *</Form.Label>
                      <Form.Control
                        type="date"
                        value={form.birthDate}
                        onChange={handleChange('birthDate')}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ảnh đại diện</Form.Label>
                      <Form.Control
                        type="url"
                        value={form.profileImageUrl}
                        onChange={handleChange('profileImageUrl')}
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="danger" disabled={submitting}>
                    {submitting ? <Spinner animation="border" size="sm" /> : 'Tạo hội viên'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => {
                      setForm(EMPTY_FORM);
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    Xoá form
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Alert variant="light" className="border small text-muted mb-0">
              Mật khẩu khởi tạo được hệ thống sinh tự động từ số điện thoại và chỉ
              lưu dạng mã hoá — không thể hiển thị lại sau khi tạo. Nếu hội viên
              quên mật khẩu, dùng chức năng đặt lại mật khẩu trong trang hồ sơ.
            </Alert>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
