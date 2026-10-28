// Receptionist – Find a Member at the front desk (US11).
//
// BE: GET /api/v1/reception/members/search?memberId=MB-123
//     GET /api/v1/reception/members/search?phone=0901234567
//     -> a single MemberSearchResponse (NOT a page)
//
// Contract details that shape this UI:
//   - Exactly one criterion must be supplied. Sending both or neither is a
//     400 VALIDATION_ERROR, so the form uses a radio group instead of a
//     free-text box.
//   - Lookup is EXACT — no full name, no email, no partial match.
//   - No pagination: both accepted identifiers are unique.
//   - INACTIVE accounts are reported as 404 on purpose.

import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import EmptyState from '../../../components/common/EmptyState';
import AuthenticatedProfileImage from '../../../components/common/AuthenticatedProfileImage';
import ReceptionActiveMembershipSummary from '../../../components/common/ReceptionActiveMembershipSummary';
import { searchReceptionMember } from '../../../services/receptionistService';
import { ACCOUNT_STATUS } from '../../../constants';
import { formatDate, normalizePhone } from '../../../utils';

const STATUS_BADGE = {
  [ACCOUNT_STATUS.ACTIVE]: 'bg-success-subtle text-success-emphasis',
  [ACCOUNT_STATUS.SUSPENDED]: 'bg-warning-subtle text-warning-emphasis',
};
const STATUS_LABELS = {
  [ACCOUNT_STATUS.ACTIVE]: 'Đang hoạt động',
  [ACCOUNT_STATUS.SUSPENDED]: 'Tạm khóa',
};

function isMemberNotFoundError(error) {
  return (
    error?.response?.status === 404 &&
    error?.response?.data?.code === 'MEMBER_NOT_FOUND'
  );
}

export default function MemberListPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // 'memberId' | 'phone' — mirrors the mutually-exclusive backend params.
  const [criterion, setCriterion] = useState('phone');
  const [memberIdInput, setMemberIdInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  // Deep-link support: /reception/members?memberId=MB-123
  const urlMemberId = params.get('memberId');
  const urlPhone = params.get('phone');

  useEffect(() => {
    if (urlMemberId) {
      setCriterion('memberId');
      setMemberIdInput(urlMemberId);
    } else if (urlPhone) {
      setCriterion('phone');
      setPhoneInput(urlPhone);
    }
  }, [urlMemberId, urlPhone]);

  useEffect(() => {
    if (!urlMemberId && !urlPhone) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearched(true);

    searchReceptionMember(
      urlMemberId ? { memberId: urlMemberId } : { phone: urlPhone },
    )
      .then((result) => {
        if (!cancelled) setMember(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setMember(null);
          setError(isMemberNotFoundError(err) ? null : err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [urlMemberId, urlPhone]);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const next = new URLSearchParams();
    if (criterion === 'memberId') {
      const id = memberIdInput.trim();
      if (!id) {
        setError(new Error('Vui lòng nhập mã hội viên.'));
        return;
      }
      next.set('memberId', id);
    } else {
      const phone = normalizePhone(phoneInput);
      if (!phone) {
        setError(new Error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'));
        return;
      }
      next.set('phone', phone);
    }
    setParams(next, { replace: true });
  }

  function handleReset() {
    setParams(new URLSearchParams(), { replace: true });
    setMemberIdInput('');
    setPhoneInput('');
    setMember(null);
    setError(null);
    setSearched(false);
  }

  return (
    <div>
      <header className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h1 className="h3 fw-bold mb-1">Tra cứu hội viên</h1>
        </div>
        <Button as={Link} to="/reception/members/new" variant="danger" size="sm">
          Đăng ký hội viên mới
        </Button>
      </header>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <Form onSubmit={handleSubmit}>
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">Tra cứu theo</Form.Label>
                <div className="btn-group w-100" role="group" aria-label="Tiêu chí tra cứu">
                  <Button
                    variant={criterion === 'memberId' ? 'danger' : 'outline-danger'}
                    onClick={() => setCriterion('memberId')}
                    type="button"
                  >
                    Mã hội viên
                  </Button>
                  <Button
                    variant={criterion === 'phone' ? 'danger' : 'outline-danger'}
                    onClick={() => setCriterion('phone')}
                    type="button"
                  >
                    Số điện thoại
                  </Button>
                </div>
              </Col>

              <Col md={5}>
                <Form.Label className="small text-muted mb-1">
                  {criterion === 'memberId' ? 'Mã hội viên' : 'Số điện thoại'}
                </Form.Label>
                {criterion === 'memberId' ? (
                  <InputGroup size="sm">
                    <Form.Control
                      value={memberIdInput}
                      onChange={(e) => setMemberIdInput(e.target.value)}
                      placeholder="MB-123"
                      maxLength={20}
                      aria-label="Mã hội viên"
                    />
                  </InputGroup>
                ) : (
                  <InputGroup size="sm">
                    <Form.Control
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="0901234567"
                      inputMode="numeric"
                      maxLength={15}
                      aria-label="Số điện thoại"
                    />
                  </InputGroup>
                )}
              </Col>

              <Col md={4} className="d-flex gap-2">
                <Button type="submit" variant="danger" disabled={loading}>
                  {loading ? <Spinner animation="border" size="sm" /> : 'Tìm'}
                </Button>
                <Button type="button" variant="outline-secondary" onClick={handleReset}>
                  Xóa
                </Button>
              </Col>
            </Row>
          </Form>

        </div>
      </div>

      <ErrorAlert
        error={error}
        title="Không tra cứu được hội viên"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : searched && !error && !member ? (
        <EmptyState
          title="Không tìm thấy hội viên"
          message="Kiểm tra lại mã hội viên hoặc số điện thoại đã nhập."
        />
      ) : member ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
              <div>
                <h2 className="h5 fw-bold mb-1">{member.fullName || '—'}</h2>
                <div className="text-muted small">
                  Mã hội viên: <span className="fw-semibold">{member.memberId}</span>
                </div>
              </div>
              <span className={`badge ${STATUS_BADGE[member.status] || 'bg-light text-dark'}`}>
                {STATUS_LABELS[member.status] || 'Không xác định'}
              </span>
            </div>

            <Row className="g-3 mt-2">
              <Col sm={6} lg={3}>
                <div className="text-muted small">Số điện thoại</div>
                <div className="fw-semibold">{member.phone || '—'}</div>
              </Col>
              <Col sm={6} lg={3}>
                <div className="text-muted small">Email</div>
                <div className="fw-semibold text-break">{member.email || '—'}</div>
              </Col>
              <Col sm={6} lg={3}>
                <div className="text-muted small">Ngày sinh</div>
                <div className="fw-semibold">{formatDate(member.birthDate)}</div>
              </Col>
              <Col sm={6} lg={3}>
                <div className="text-muted small">Ảnh đại diện</div>
                <AuthenticatedProfileImage
                  src={member.profileImageUrl}
                  alt={`Ảnh ${member.fullName || member.memberId}`}
                  width="48"
                  height="48"
                  className="rounded border"
                  style={{ objectFit: 'cover' }}
                  fallback={<span className="text-muted">—</span>}
                />
              </Col>
            </Row>

            <ReceptionActiveMembershipSummary
              membership={member.activeMembership}
              memberCode={member.memberId}
            />

            <div className="mt-3 d-flex flex-wrap gap-2">
              <Button as={Link} to={`/reception/members/${member.memberId}`} variant="outline-danger" size="sm">
                Xem hồ sơ đầy đủ
              </Button>
              <Button
                as={Link}
                to={`/reception/members/${member.memberId}/bookings`}
                state={{ from: `${location.pathname}${location.search}` }}
                variant="outline-danger"
                size="sm"
              >
                Đặt / quản lý lịch
              </Button>
              <Button
                as={Link}
                to={`/reception/orders/new?memberId=${member.memberId}`}
                variant="danger"
                size="sm"
                disabled={member.status !== ACCOUNT_STATUS.ACTIVE}
                title={
                  member.status === ACCOUNT_STATUS.ACTIVE
                    ? 'Tạo đơn và chọn phương thức thanh toán'
                    : 'Chỉ tạo đơn với tài khoản đang hoạt động'
                }
              >
                Tạo đơn gói tập
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
