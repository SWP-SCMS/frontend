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
//
// Native browser note:
//   - The profileImageUrl input is declared <Form.Control type="url"> and
//     the surrounding <Form> intentionally does NOT use noValidate, so
//     the browser still runs the native URL-format check on this field
//     when it is non-empty. This migration preserves that behavior:
//     (1) the new <Form> keeps no noValidate flag, and (2) profileImageUrl
//     is registered through the input as type="url", so the user sees
//     the same browser tooltip if they enter something obviously bad.
//     We do NOT add a Zod regex here — only F04 enforces a URL regex at
//     validation time.

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
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createReceptionMember } from '../../../services/receptionistService';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  fullNameSchema,
  emailSchema,
  phoneCreateSchema,
  birthDateSchema,
} from '../../../schemas/fragments';

// Page-local schema: shared fragments + optional profileImageUrl.
// No URL-regex check is added here on purpose — see the file header.
const memberCreateSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneCreateSchema,
  email: emailSchema,
  birthDate: birthDateSchema,
  profileImageUrl: z.string(),
});

export default function MemberCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [created, setCreated] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(memberCreateSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
      profileImageUrl: '',
    },
  });

  function startAnother() {
    setCreated(null);
    setServerError(null);
    setNotice(null);
    reset({
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
      profileImageUrl: '',
    });
  }

  function resetForm() {
    setServerError(null);
    reset({
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
      profileImageUrl: '',
    });
  }

  async function onSubmit(data) {
    setServerError(null);
    setNotice(null);

    const payload = {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      birthDate: data.birthDate,
    };
    const imageUrl = data.profileImageUrl.trim();
    if (imageUrl) {
      payload.profileImageUrl = imageUrl;
    }

    try {
      const member = await createReceptionMember(payload);
      setCreated(member);
      reset({
        fullName: '',
        phone: '',
        email: '',
        birthDate: '',
        profileImageUrl: '',
      });
    } catch (err) {
      // Shared helper: data.errors + EMAIL/PHONE uniqueness.
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: ['fullName', 'phone', 'email', 'birthDate', 'profileImageUrl'],
      });

      const code = err?.response?.data?.code;
      // ACCOUNT_IDENTIFIER_ALREADY_EXISTS has no specific field clue from
      // the backend; surface it as a page-level operator warning
      // (`setNotice` renders a separate <Alert variant="warning">,
      // NOT the global ErrorAlert). This is the explicit page-local
      // banner preserved from the pre-migration source — it MUST stay
      // unconditional so the operator sees the same workflow regardless
      // of whether EMAIL/PHONE uniqueness was already mapped inline.
      if (
        code === 'EMAIL_ALREADY_EXISTS' ||
        code === 'PHONE_ALREADY_EXISTS' ||
        code === 'ACCOUNT_IDENTIFIER_ALREADY_EXISTS'
      ) {
        const alreadyEmail = Boolean(errors.email);
        const alreadyPhone = Boolean(errors.phone);
        setNotice(
          code === 'EMAIL_ALREADY_EXISTS' && !alreadyEmail
            ? 'Email này đã được một tài khoản khác sử dụng. Vui lòng nhập email khác.'
            : code === 'PHONE_ALREADY_EXISTS' && !alreadyPhone
              ? 'Số điện thoại này đã được một tài khoản khác sử dụng. Vui lòng nhập số khác.'
              : 'Email hoặc số điện thoại vừa được dùng cho một tài khoản khác. Vui lòng kiểm tra lại.',
        );
      }

      // Global ErrorAlert is the shared-helper path's fallback: only
      // raised when the helper did NOT handle the error. The page-local
      // `setNotice` banner above is independent and is preserved.
      if (!handled) {
        setServerError(err);
      }
    }
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
        error={serverError}
        title="Không tạo được hội viên"
        onClose={error?.response ? () => setServerError(null) : undefined}
      />

      {/* Note: no noValidate here on purpose — the profileImageUrl input
          relies on the browser's native URL-format tooltip when non-empty.
          The RHF layer never re-validates that field with a stricter regex. */}
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Row className="g-3">
          <Col lg={7}>
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted mb-1">Họ và tên *</Form.Label>
                  <Form.Control
                    {...register('fullName')}
                    maxLength={200}
                    isInvalid={Boolean(errors.fullName)}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.fullName?.message}
                  </Form.Control.Feedback>
                </Form.Group>

                <Row className="g-3">
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Số điện thoại *</Form.Label>
                      <Form.Control
                        {...register('phone')}
                        inputMode="numeric"
                        isInvalid={Boolean(errors.phone)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.phone?.message}
                      </Form.Control.Feedback>
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
                        {...register('email')}
                        maxLength={320}
                        isInvalid={Boolean(errors.email)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.email?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ngày sinh *</Form.Label>
                      <Form.Control
                        type="date"
                        {...register('birthDate')}
                        max={new Date().toISOString().slice(0, 10)}
                        isInvalid={Boolean(errors.birthDate)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.birthDate?.message}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted mb-1">Ảnh đại diện</Form.Label>
                      {/* type="url" stays: the user-visible browser tooltip
                          on malformed URLs is the existing UX. RHF's
                          register() does not enforce a regex here. */}
                      <Form.Control
                        type="url"
                        {...register('profileImageUrl')}
                        placeholder="Không bắt buộc"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button type="submit" variant="danger" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner animation="border" size="sm" /> : 'Tạo hội viên'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={resetForm}
                    disabled={isSubmitting}
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
