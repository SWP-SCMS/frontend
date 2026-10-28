// Receptionist – Create a Member at the front desk (US15).
//
// BE: POST /api/v1/reception/members
//     body: { fullName, phone, email, birthDate }
//     -> 201 CreateMemberResponse (no password, no token, no cookie)
// BE: POST /api/v1/reception/members/{memberId}/profile/image
//     multipart/form-data: file
//
// Contract details that shape this UI:
//   - All of fullName/phone/email/birthDate are required. birthDate must not
//     be in the future, and the Member must be at least 16 years old.
//   - 409 EMAIL_ALREADY_EXISTS / PHONE_ALREADY_EXISTS /
//     ACCOUNT_IDENTIFIER_ALREADY_EXISTS for a concurrent create.
//   - additionalProperties: false — we must not send role/status/accountId.

import { useRef, useState } from 'react';
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
import { RhfDateInput } from '../../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  createReceptionMember,
  uploadReceptionMemberProfileImage,
} from '../../../services/receptionistService';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  isAtLeastAgeOnGymDate,
  latestEligibleBirthDate,
} from '../../../utils/gymTime';
import {
  fullNameSchema,
  emailSchema,
  phoneCreateSchema,
  birthDateSchema,
} from '../../../schemas/fragments';

function isAtLeast16YearsOld(birthDate) {
  return isAtLeastAgeOnGymDate(birthDate, 16);
}

const memberBirthDateSchema = birthDateSchema.refine(isAtLeast16YearsOld, {
  message: 'Hội viên phải đủ 16 tuổi.',
});

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

// Page-local schema: shared fragments + creation-only minimum age.
const memberCreateSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneCreateSchema,
  email: emailSchema,
  birthDate: memberBirthDateSchema,
});

export default function MemberCreatePage() {
  const navigate = useNavigate();
  const profileImageInputRef = useRef(null);
  const [serverError, setServerError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [created, setCreated] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImageError, setProfileImageError] = useState('');
  const [imageUploadWarning, setImageUploadWarning] = useState('');

  const {
    register,
    control,
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
    },
  });

  function startAnother() {
    setCreated(null);
    setServerError(null);
    setNotice(null);
    setProfileImageFile(null);
    setProfileImageError('');
    setImageUploadWarning('');
    reset({
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
    });
  }

  function resetForm() {
    setServerError(null);
    setProfileImageFile(null);
    setProfileImageError('');
    if (profileImageInputRef.current) {
      profileImageInputRef.current.value = '';
    }
    reset({
      fullName: '',
      phone: '',
      email: '',
      birthDate: '',
    });
  }

  function selectProfileImage(event) {
    const file = event.target.files?.[0] ?? null;
    setProfileImageError('');

    if (!file) {
      setProfileImageFile(null);
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setProfileImageFile(null);
      setProfileImageError('Chỉ chấp nhận ảnh JPEG hoặc PNG.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setProfileImageFile(null);
      setProfileImageError('Ảnh không được vượt quá 5 MiB.');
      event.target.value = '';
      return;
    }

    setProfileImageFile(file);
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
    try {
      const member = await createReceptionMember(payload);
      let uploadWarning = '';
      if (profileImageFile) {
        try {
          await uploadReceptionMemberProfileImage(member.memberId, profileImageFile);
        } catch {
          uploadWarning =
            'Hội viên đã được tạo nhưng chưa tải được ảnh đại diện. Có thể tải lại trong hồ sơ hội viên.';
        }
      }

      setImageUploadWarning(uploadWarning);
      setCreated(member);
      setProfileImageFile(null);
      setProfileImageError('');
      reset({
        fullName: '',
        phone: '',
        email: '',
        birthDate: '',
      });
    } catch (err) {
      // Shared helper: data.errors + EMAIL/PHONE uniqueness.
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: ['fullName', 'phone', 'email', 'birthDate'],
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

        {imageUploadWarning ? <Alert variant="warning">{imageUploadWarning}</Alert> : null}

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
        onClose={serverError?.response ? () => setServerError(null) : undefined}
      />

      <Form onSubmit={handleSubmit(onSubmit)}>
        <Row className="g-3">
          <Col lg={12}>
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
                        Dùng làm định danh đăng nhập.
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
                      <RhfDateInput
                        control={control}
                        name="birthDate"
                        max={latestEligibleBirthDate(16)}
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
                      <Form.Control
                        ref={profileImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={selectProfileImage}
                        isInvalid={Boolean(profileImageError)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {profileImageError}
                      </Form.Control.Feedback>
                      <Form.Text>Không bắt buộc. JPEG hoặc PNG, tối đa 5 MiB.</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex gap-2">
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={isSubmitting || Boolean(profileImageError)}
                  >
                    {isSubmitting ? <Spinner animation="border" size="sm" /> : 'Tạo hội viên'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    Xóa form
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

        </Row>
      </Form>
    </div>
  );
}
