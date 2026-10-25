import { useEffect, useRef, useState } from 'react';
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
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import AuthenticatedProfileImage from '../../../components/common/AuthenticatedProfileImage';
import ReceptionActiveMembershipSummary from '../../../components/common/ReceptionActiveMembershipSummary';
import { ACCOUNT_STATUS } from '../../../constants';
import {
  createReceptionCenterVisit,
  searchReceptionMember,
} from '../../../services/receptionistService';
import { normalizePhone } from '../../../utils';

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
};

const STATUS_LABELS = {
  [ACCOUNT_STATUS.ACTIVE]: 'Đang hoạt động',
  [ACCOUNT_STATUS.SUSPENDED]: 'Tạm khóa',
  [ACCOUNT_STATUS.INACTIVE]: 'Ngưng hoạt động',
};

const memberSearchSchema = z
  .object({
    criterion: z.enum(['memberId', 'phone']),
    query: z.string(),
  })
  .superRefine(({ criterion, query }, context) => {
    const value = query.trim();
    if (!value) {
      context.addIssue({
        code: 'custom',
        path: ['query'],
        message:
          criterion === 'memberId'
            ? 'Vui lòng nhập mã hội viên.'
            : 'Vui lòng nhập số điện thoại.',
      });
      return;
    }
    if (criterion === 'memberId' && value.length > 20) {
      context.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'Mã hội viên không được vượt quá 20 ký tự.',
      });
    }
    if (criterion === 'phone' && !normalizePhone(value)) {
      context.addIssue({
        code: 'custom',
        path: ['query'],
        message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.',
      });
    }
  });

const centerCheckInSchema = z.object({
  identityVerified: z.boolean().refine(Boolean, {
    message: 'Vui lòng xác nhận đã đối chiếu ảnh và danh tính hội viên.',
  }),
});

const CENTER_CHECK_IN_TIME_FORMATTER = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const CHECK_IN_BUSINESS_ERRORS = {
  MEMBERSHIP_FROZEN:
    'Gói tập của hội viên đang được đóng băng nên chưa thể check-in trung tâm.',
  CENTER_VISIT_MEMBER_NOT_ACTIVE:
    'Tài khoản hội viên phải đang hoạt động mới có thể check-in trung tâm.',
  CENTER_VISIT_PROFILE_IMAGE_REQUIRED:
    'Hội viên cần có ảnh hồ sơ trước khi check-in trung tâm.',
  CENTER_VISIT_MEMBERSHIP_REQUIRED:
    'Hội viên cần có gói tập còn hiệu lực với quyền sử dụng trung tâm để check-in.',
};

function formatCenterCheckInTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return CENTER_CHECK_IN_TIME_FORMATTER.format(date);
}

export default function ReceptionCenterCheckInPage() {
  const [selectedMember, setSelectedMember] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [checkInBusinessError, setCheckInBusinessError] = useState(null);
  const [checkInError, setCheckInError] = useState(null);
  const [checkInSuccess, setCheckInSuccess] = useState(null);
  const checkInIdempotencyKeyRef = useRef(null);
  const checkInRequestInFlightRef = useRef(false);

  const {
    register: registerSearch,
    handleSubmit: handleSearchSubmit,
    reset: resetSearch,
    setFocus: setSearchFocus,
    formState: {
      errors: searchFieldErrors,
      isSubmitting: searchSubmitting,
    },
  } = useForm({
    resolver: zodResolver(memberSearchSchema),
    defaultValues: {
      criterion: 'memberId',
      query: '',
    },
  });

  const {
    register: registerCheckIn,
    handleSubmit: handleCheckInSubmit,
    reset: resetCheckIn,
    setError: setCheckInFieldError,
    formState: {
      errors: checkInFieldErrors,
      isSubmitting: checkInSubmitting,
    },
  } = useForm({
    resolver: zodResolver(centerCheckInSchema),
    defaultValues: { identityVerified: false },
  });

  useEffect(() => {
    checkInIdempotencyKeyRef.current = null;
    checkInRequestInFlightRef.current = false;
    setCheckInBusinessError(null);
    setCheckInError(null);
    setCheckInSuccess(null);
    resetCheckIn({ identityVerified: false });
  }, [selectedMember?.memberId, resetCheckIn]);

  async function searchMember(values) {
    setSearchError(null);
    setSearched(true);
    setSelectedMember(null);

    try {
      const query = values.query.trim();
      const result = await searchReceptionMember(
        values.criterion === 'memberId'
          ? { memberId: query }
          : { phone: normalizePhone(query) },
      );
      setSelectedMember(result);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (err?.response?.status === 404 && code === 'MEMBER_NOT_FOUND') {
        setSearchError(null);
      } else {
        setSearchError(err);
      }
    }
  }

  async function submitCenterCheckIn(values) {
    if (!selectedMember || checkInRequestInFlightRef.current) return;

    checkInRequestInFlightRef.current = true;
    setCheckInBusinessError(null);
    setCheckInError(null);

    try {
      if (!checkInIdempotencyKeyRef.current) {
        checkInIdempotencyKeyRef.current = crypto.randomUUID();
      }

      const result = await createReceptionCenterVisit(
        {
          memberId: selectedMember.memberId,
          identityVerified: values.identityVerified,
        },
        checkInIdempotencyKeyRef.current,
      );

      checkInIdempotencyKeyRef.current = null;
      setCheckInSuccess({ result, fullName: selectedMember.fullName });
      resetCheckIn({ identityVerified: false });
      resetSearch({ criterion: 'memberId', query: '' });
      setSelectedMember(null);
      setSearched(false);
      setTimeout(() => setSearchFocus('query'), 0);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'IDENTITY_VERIFICATION_REQUIRED') {
        setCheckInFieldError('identityVerified', {
          type: 'server',
          message: 'Vui lòng xác nhận đã đối chiếu ảnh và danh tính hội viên.',
        });
      } else if (CHECK_IN_BUSINESS_ERRORS[code]) {
        setCheckInBusinessError(CHECK_IN_BUSINESS_ERRORS[code]);
      } else {
        setCheckInError(err);
      }
    } finally {
      checkInRequestInFlightRef.current = false;
    }
  }

  const activeMembership = selectedMember?.activeMembership || null;
  const hasCenterAccess = activeMembership?.benefitCodes?.includes('CENTER_ACCESS');
  const checkInBlocked = selectedMember
    ? selectedMember.status !== ACCOUNT_STATUS.ACTIVE ||
      !selectedMember.profileImageUrl ||
      !activeMembership ||
      activeMembership.frozen ||
      !hasCenterAccess
    : true;

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Check-in trung tâm</h1>
        <p className="text-muted mb-0">
          Tìm hội viên và xác nhận thông tin trước khi vào trung tâm.
        </p>
      </header>

      {checkInSuccess ? (
        <Alert
          variant="success"
          dismissible
          onClose={() => setCheckInSuccess(null)}
        >
          {checkInSuccess.result.created
            ? `Đã check-in trung tâm cho ${checkInSuccess.fullName || 'Hội viên'} (${checkInSuccess.result.memberCode}) lúc ${formatCenterCheckInTime(checkInSuccess.result.checkedInAt)}.`
            : `Yêu cầu check-in này đã được xử lý trước đó lúc ${formatCenterCheckInTime(checkInSuccess.result.checkedInAt)}; hệ thống không tạo thêm lượt vào.`}
        </Alert>
      ) : null}

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Form onSubmit={handleSearchSubmit(searchMember)} noValidate>
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label htmlFor="checkInSearchCriterion">
                  Tra cứu theo
                </Form.Label>
                <Form.Select
                  id="checkInSearchCriterion"
                  disabled={searchSubmitting || checkInSubmitting}
                  {...registerSearch('criterion')}
                >
                  <option value="memberId">Mã hội viên</option>
                  <option value="phone">Số điện thoại</option>
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label htmlFor="checkInSearchQuery">
                  Mã hội viên hoặc số điện thoại
                </Form.Label>
                <Form.Control
                  id="checkInSearchQuery"
                  placeholder="MB-100001 hoặc 0901234567"
                  disabled={searchSubmitting || checkInSubmitting}
                  isInvalid={Boolean(searchFieldErrors.query)}
                  {...registerSearch('query')}
                />
                <Form.Control.Feedback type="invalid">
                  {searchFieldErrors.query?.message}
                </Form.Control.Feedback>
              </Col>
              <Col md={3}>
                <Button
                  type="submit"
                  variant="danger"
                  className="w-100"
                  disabled={searchSubmitting || checkInSubmitting}
                >
                  {searchSubmitting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Đang tìm...
                    </>
                  ) : (
                    'Tìm hội viên'
                  )}
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <ErrorAlert
        error={searchError}
        title="Không tra cứu được hội viên"
        onClose={() => setSearchError(null)}
      />

      {searchSubmitting ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : searched && !searchError && !selectedMember ? (
        <Card className="border-0 shadow-sm">
          <EmptyState
            title="Không tìm thấy hội viên"
            message="Kiểm tra lại mã hội viên hoặc số điện thoại đã nhập."
          />
        </Card>
      ) : selectedMember ? (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <Row className="g-4 align-items-start">
              <Col md="auto" className="text-center">
                <AuthenticatedProfileImage
                  src={selectedMember.profileImageUrl}
                  alt={`Ảnh hồ sơ của ${selectedMember.fullName || selectedMember.memberId}`}
                  className="img-thumbnail rounded"
                  width="200"
                  height="200"
                  style={{ objectFit: 'cover' }}
                  fallback={<div
                    className="border rounded bg-light text-muted d-flex align-items-center justify-content-center p-3"
                    style={{ width: 200, height: 200 }}
                  >
                    Chưa có ảnh hồ sơ
                  </div>}
                />
              </Col>

              <Col>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h2 className="h4 fw-bold mb-1">
                      {selectedMember.fullName || 'Hội viên'}
                    </h2>
                    <div className="text-muted">
                      Mã hội viên:{' '}
                      <span className="fw-semibold">
                        {selectedMember.memberId}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge ${STATUS_BADGE[selectedMember.status] || 'bg-light text-dark'}`}
                  >
                    {STATUS_LABELS[selectedMember.status] || selectedMember.status || '—'}
                  </span>
                </div>

                <dl className="row mb-3">
                  <dt className="col-sm-4 text-muted fw-normal">
                    Số điện thoại
                  </dt>
                  <dd className="col-sm-8 fw-semibold">
                    {selectedMember.phone || '—'}
                  </dd>
                  <dt className="col-sm-4 text-muted fw-normal">
                    Trạng thái tài khoản
                  </dt>
                  <dd className="col-sm-8">
                    {STATUS_LABELS[selectedMember.status] || selectedMember.status || '—'}
                  </dd>
                </dl>

                <ReceptionActiveMembershipSummary
                  membership={activeMembership}
                  memberCode={selectedMember.memberId}
                />

                {activeMembership && !activeMembership.frozen && !hasCenterAccess ? (
                  <Alert variant="warning" className="mt-3">
                    Gói hiện tại không có quyền ra/vào trung tâm nên chưa thể check-in.
                  </Alert>
                ) : null}

                {selectedMember.status === ACCOUNT_STATUS.SUSPENDED ? (
                  <Alert variant="warning">
                    Tài khoản đang tạm khóa nên chưa thể check-in. Quản lý cần
                    mở lại tài khoản trước khi hội viên sử dụng trung tâm.
                  </Alert>
                ) : null}

                {!selectedMember.profileImageUrl ? (
                  <Alert variant="warning">
                    Hội viên chưa có ảnh hồ sơ nên chưa thể check-in.{' '}
                    <Alert.Link
                      as={Link}
                      to={`/reception/members/${selectedMember.memberId}`}
                    >
                      Mở hồ sơ hội viên
                    </Alert.Link>
                    {' '}để bổ sung ảnh.
                  </Alert>
                ) : null}

                {checkInBusinessError ? (
                  <Alert variant="warning">{checkInBusinessError}</Alert>
                ) : null}

                <ErrorAlert
                  error={checkInError}
                  title="Không check-in được hội viên"
                  onClose={() => setCheckInError(null)}
                />

                <Form
                  onSubmit={(event) =>
                    handleCheckInSubmit(submitCenterCheckIn)(event)
                  }
                  noValidate
                >
                  <Form.Check
                    type="checkbox"
                    id="identityVerified"
                    label="Tôi đã đối chiếu hội viên với ảnh hồ sơ"
                    className="mb-3"
                    disabled={checkInSubmitting || checkInBlocked}
                    isInvalid={Boolean(checkInFieldErrors.identityVerified)}
                    feedback={checkInFieldErrors.identityVerified?.message}
                    feedbackType="invalid"
                    {...registerCheckIn('identityVerified')}
                  />
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={checkInSubmitting || checkInBlocked}
                  >
                    {checkInSubmitting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Đang check-in...
                      </>
                    ) : (
                      'Xác nhận check-in'
                    )}
                  </Button>
                </Form>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ) : null}
    </div>
  );
}
