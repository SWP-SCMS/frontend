// Manager – Session detail (US29) + Cancel (US31).
//
// Read-only view of a single Class Session. Loads via the dedicated
// GET /api/v1/manager/class-sessions/{id} endpoint.
//
// ClassSessionDetailResponse (server-resolved labels; no client-side
// listClasses / listRooms / searchStaffAccounts lookups on this page):
//   { id, classId, className, classType, disciplineId, disciplineName,
//     coachId, coachName, roomId, roomName, roomCapacity,
//     recurringScheduleId, startTime, endTime, capacity, status,
//     cancelledAt, cancellationReason, createdBy,
//     canUpdateAssignment, canCancel }
//
// bookedCount is intentionally NOT rendered: the verified detail DTO
// does not include it.
//
// US29 surfaces the detail only (read-only). US31 extends the page
// with a single destructive action ("Hủy buổi tập") rendered as a
// Bootstrap Modal containing an RHF + Zod reason form. The PATCH
// success response is the authoritative full ClassSessionDetailResponse
// and is applied directly via setSession — no navigate-away, no extra
// GET refetch, no separate Booking / Notification / Audit calls.

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { applyServerErrors } from '../../../utils/serverErrors';
import {
  cancelSession,
  getManagerSessionDetail,
} from '../../../services/classSessionService';

const GYM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const STATUS_BADGE = {
  SCHEDULED: 'bg-primary-subtle text-primary-emphasis',
  IN_PROGRESS: 'bg-warning-subtle text-warning-emphasis',
  COMPLETED: 'bg-success-subtle text-success-emphasis',
  CANCELLED: 'bg-secondary-subtle text-secondary-emphasis',
};

const STATUS_LABEL = {
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const TYPE_LABEL = {
  GROUP: 'Nhóm',
  YOGA: 'Yoga',
  PT_1_1: 'PT 1:1',
};

// ----- Asia/Ho_Chi_Minh helpers (page-local; same convention as US28) -----

function formatGymDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatGymTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    timeZone: GYM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatGymDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatGymDate(iso)} · ${formatGymTime(iso)}`;
}

// Safe internal-only back target. Accepts only paths that start with
// /manager/class-sessions to avoid ever navigating to an arbitrary URL.
function resolveBackTarget(state) {
  const from = state && typeof state.from === 'string' ? state.from : null;
  if (from && from.startsWith('/manager/class-sessions')) {
    return from;
  }
  return '/manager/class-sessions';
}

// US30 — one-time success flag surfaced by the Assignment Edit page
// after a successful PATCH. Stripped from the URL state on mount so
// refresh / back / forward do not replay the same toast.
function readAssignmentUpdatedFlag(state) {
  return Boolean(state && state.assignmentUpdated === true);
}

// US30 — determine whether the current detail page is eligible for
// the "Cập nhật HLV / Phòng" action. Mirrors BR-SES-06:
//   * Session must be SCHEDULED, AND
//   * canUpdateAssignment must not be explicitly false.
// The server is authoritative; this is a UX gate only.
function canEditAssignment(session) {
  if (!session) return false;
  if (session.status !== 'SCHEDULED') return false;
  if (session.canUpdateAssignment === false) return false;
  return true;
}

// US31 — determine whether the current detail page is eligible for
// the "Hủy buổi tập" action. Mirrors BR-SES-03:
//   * Session must be SCHEDULED, AND
//   * canCancel must not be explicitly false.
// The server is authoritative; this is a UX gate only. canCancel is
// computed by the BE as `status === SCHEDULED` (same boolean reused
// for canUpdateAssignment — verified at ClassSessionDetailResponse.from).
function canCancelSession(session) {
  if (!session) return false;
  if (session.status !== 'SCHEDULED') return false;
  if (session.canCancel === false) return false;
  return true;
}

// US31 — page-local Zod schema for the cancel reason. Mirrors the BE
// validation in ClassSessionCancellationService#validate:
//   - reason is REQUIRED (string, non-blank after trim, <= 1000 chars).
// Zod's `.trim()` runs BEFORE .min(1) / .max(1000), so the resolved
// value is already trimmed and matches the BE's trimmed value.
const cancelReasonSchema = z.object({
  reason: z
    .string({
      required_error: 'Vui lòng nhập lý do hủy.',
      invalid_type_error: 'Lý do hủy không hợp lệ.',
    })
    .trim()
    .min(1, 'Vui lòng nhập lý do hủy.')
    .max(1000, 'Lý do hủy không được vượt quá 1000 ký tự.'),
});

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const backTarget = resolveBackTarget(location.state);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // US30 — render a one-time success Alert when the Assignment Edit
  // page redirected here with `state.assignmentUpdated === true`.
  // The flag is consumed (and stripped from the history state) on
  // mount so that refresh / back / forward do not replay the same
  // success message.
  const [assignmentUpdated] = useState(() =>
    readAssignmentUpdatedFlag(location.state),
  );

  useEffect(() => {
    if (!assignmentUpdated) return undefined;
    // Build the next history state with the flag removed. We keep
    // every other safe key (notably `from`) intact so the existing
    // back-link behavior is unchanged.
    const next = { ...(location.state || {}) };
    delete next.assignmentUpdated;
    const hasAnything = Object.keys(next).length > 0;
    navigate(location.pathname + location.search, {
      replace: true,
      state: hasAnything ? next : null,
    });
    // Intentionally no `setTimeout`. Cleanup runs once; the flag
    // also stays in local state so the Alert renders for the rest
    // of this mount.
    return undefined;
    // location.state is captured intentionally at mount; further
    // mutations to it would only be the strip-effect itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- US31 — Cancel Session modal state -----
  // The cancel flow stays on this page (no navigate-away). The PATCH
  // response is the authoritative full ClassSessionDetailResponse and
  // is applied directly via setSession. One-time success feedback is
  // local component state — it does not ride in location.state.
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelServerError, setCancelServerError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const {
    register: registerCancel,
    handleSubmit: handleCancelSubmit,
    reset: resetCancel,
    setError: setCancelFieldError,
    formState: { errors: cancelErrors, isValid: isCancelValid },
  } = useForm({
    resolver: zodResolver(cancelReasonSchema),
    mode: 'onChange',
    defaultValues: { reason: '' },
  });

  function openCancelModal() {
    setCancelServerError(null);
    setCancelSuccess(false);
    resetCancel({ reason: '' });
    setShowCancelModal(true);
  }

  function closeCancelModal() {
    if (cancelling) return;
    setShowCancelModal(false);
    setCancelServerError(null);
    resetCancel({ reason: '' });
  }

  async function onCancelSubmit(data) {
    setCancelServerError(null);
    // Defense-in-depth: refuse to send if the page-local gate says
    // the Session is no longer cancellable. The button is hidden in
    // this state, but a stale page could still trigger this.
    if (!canCancelSession(session)) {
      setCancelServerError({
        message:
          'Buổi tập này không ở trạng thái Đã lên lịch nên không thể hủy.',
      });
      return;
    }
    setCancelling(true);
    try {
      const updated = await cancelSession(sessionId, {
        reason: data.reason.trim(),
      });
      // Authoritative PATCH response — apply directly. No navigate,
      // no extra GET, no separate Booking/Notification/Audit calls.
      setSession(updated);
      setShowCancelModal(false);
      setCancelSuccess(true);
      resetCancel({ reason: '' });
    } catch (err) {
      const code = err?.response?.data?.code;
      // VALIDATION_ERROR with data.errors.reason → inline reason.
      // Other codes (SESSION_NOT_FOUND, SESSION_NOT_SCHEDULED,
      // MALFORMED_REQUEST, INVALID_TOKEN, role mismatch, generic 5xx)
      // fall through to the global ErrorAlert.
      const sharedHandled = applyServerErrors(err, setCancelFieldError, {
        fields: ['reason'],
      });
      let pageLocalHandled = false;
      switch (code) {
        case 'SESSION_NOT_FOUND':
        case 'SESSION_NOT_SCHEDULED':
        case 'MALFORMED_REQUEST':
          setCancelServerError(err);
          pageLocalHandled = true;
          break;
        default:
          break;
      }
      if (!sharedHandled && !pageLocalHandled) {
        setCancelServerError(err);
      }
    } finally {
      setCancelling(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getManagerSessionDetail(sessionId);
      setSession(data);
    } catch (err) {
      setSession(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div>
        <Link to={backTarget} className="small text-decoration-none">
          ← Quay lại Buổi tập
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được buổi tập"
        />
      </div>
    );
  }

  const status = session.status || '';
  const typeLabel = TYPE_LABEL[session.classType] || session.classType || '—';
  const isCancelled = status === 'CANCELLED';

  return (
    <div>
      <Link to={backTarget} className="small text-decoration-none">
        ← Quay lại Buổi tập
      </Link>

      {assignmentUpdated ? (
        <Alert variant="success" className="mt-3 mb-0 py-2">
          Cập nhật thành công.
        </Alert>
      ) : null}

      {cancelSuccess ? (
        <Alert
          variant="success"
          className="mt-3 mb-0 py-2"
          dismissible
          onClose={() => setCancelSuccess(false)}
        >
          Hủy buổi tập thành công.
        </Alert>
      ) : null}

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">
            {session.className || '—'}
          </h1>
          <p className="text-muted mb-1">Buổi tập</p>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span
              className={`badge ${STATUS_BADGE[status] || 'bg-light text-dark'}`}
            >
              {STATUS_LABEL[status] || status || '—'}
            </span>
            <span className="text-muted small">
              {formatGymDate(session.startTime)} ·{' '}
              {formatGymTime(session.startTime)} –{' '}
              {formatGymTime(session.endTime)}
            </span>
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {canEditAssignment(session) ? (
            <Button
              as={Link}
              to={`/manager/class-sessions/${sessionId}/assignment/edit`}
              state={backTarget ? { from: backTarget } : undefined}
              variant="outline-danger"
              size="sm"
            >
              Cập nhật HLV / Phòng
            </Button>
          ) : null}
          {canCancelSession(session) ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={openCancelModal}
            >
              Hủy buổi tập
            </Button>
          ) : null}
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Ngày</h2>
              <p className="mb-2 fw-semibold">
                {formatGymDate(session.startTime)}
              </p>
              <h2 className="h6 text-uppercase text-muted">Giờ</h2>
              <p className="mb-0 fw-semibold">
                {formatGymTime(session.startTime)} –{' '}
                {formatGymTime(session.endTime)}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">
                Huấn luyện viên
              </h2>
              <p className="mb-0 fw-semibold">
                {session.coachName || '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Phòng tập</h2>
              <p className="mb-1 fw-semibold">
                {session.roomName || '—'}
              </p>
              <p className="text-muted small mb-0">
                Sức chứa phòng:{' '}
                {typeof session.roomCapacity === 'number'
                  ? session.roomCapacity
                  : '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">
                Sức chứa buổi tập
              </h2>
              <p className="mb-0 fw-semibold">
                {typeof session.capacity === 'number'
                  ? session.capacity
                  : '—'}
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Bộ môn</h2>
              {session.disciplineId ? (
                <Link
                  to={`/manager/disciplines/${session.disciplineId}`}
                  className="fw-semibold text-decoration-none"
                >
                  {session.disciplineName || '—'}
                </Link>
              ) : (
                <span className="fw-semibold">
                  {session.disciplineName || '—'}
                </span>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Loại lớp</h2>
              <p className="mb-0 fw-semibold">{typeLabel}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {isCancelled ? (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <h2 className="h6 text-uppercase text-muted">Huỷ</h2>
            <p className="mb-2 small text-muted">
              Thời điểm huỷ: {formatGymDateTime(session.cancelledAt)}
            </p>
            <h2 className="h6 text-uppercase text-muted">Lý do huỷ</h2>
            <p
              className="mb-0"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {session.cancellationReason
                ? session.cancellationReason
                : '—'}
            </p>
          </Card.Body>
        </Card>
      ) : null}

      {/* ----- US31 — Cancel Session modal ----- */}
      <Modal
        show={showCancelModal}
        onHide={closeCancelModal}
        centered
        backdrop={cancelling ? 'static' : true}
        keyboard={!cancelling}
      >
        <Modal.Header closeButton>
          <Modal.Title>Hủy buổi tập</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCancelSubmit(onCancelSubmit)} noValidate>
          <Modal.Body>
            <p className="text-muted small mb-3">
              Buổi tập sẽ được chuyển sang trạng thái Đã huỷ và vẫn
              được giữ lại trong lịch sử. Các lượt đăng ký hiện đang
              BOOKED của buổi tập này sẽ được hệ thống xử lý theo
              quy tắc nghiệp vụ phía backend.
            </p>

            {/* Read-only context block (mirrors the US30 read-only block) */}
            <div className="border rounded p-3 mb-3 bg-light">
              <Row className="g-3">
                <Col md={6}>
                  <div className="text-uppercase small text-muted">
                    Lớp học
                  </div>
                  <div className="fw-semibold">
                    {session.className || '—'}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-uppercase small text-muted">
                    Ngày · Giờ
                  </div>
                  <div className="fw-semibold">
                    {formatGymDate(session.startTime)} ·{' '}
                    {formatGymTime(session.startTime)} –{' '}
                    {formatGymTime(session.endTime)}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-uppercase small text-muted">
                    Huấn luyện viên
                  </div>
                  <div className="fw-semibold">
                    {session.coachName || '—'}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-uppercase small text-muted">
                    Phòng tập
                  </div>
                  <div className="fw-semibold">
                    {session.roomName || '—'}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="text-uppercase small text-muted">
                    Sức chứa buổi tập
                  </div>
                  <div className="fw-semibold">
                    {typeof session.capacity === 'number'
                      ? session.capacity
                      : '—'}
                  </div>
                </Col>
              </Row>
            </div>

            <ErrorAlert
              error={cancelServerError}
              title="Không hủy được buổi tập"
              onClose={
                cancelServerError
                  ? () => setCancelServerError(null)
                  : undefined
              }
            />

            <Form.Group controlId="cancel-reason">
              <Form.Label>Lý do hủy *</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                maxLength={1000}
                placeholder="Ví dụ: HLV xin nghỉ đột xuất; lớp học bị trùng phòng…"
                isInvalid={Boolean(cancelErrors.reason)}
                {...registerCancel('reason')}
                disabled={cancelling}
              />
              <Form.Text className="text-muted">
                Bắt buộc. Tối đa 1000 ký tự. Lý do sẽ được lưu vào
                lịch sử huỷ.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {cancelErrors.reason?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeCancelModal}
              disabled={cancelling}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!isCancelValid || cancelling}
            >
              {cancelling ? (
                <>
                  <Spinner
                    size="sm"
                    animation="border"
                    className="me-2"
                  />
                  Đang hủy…
                </>
              ) : (
                'Xác nhận hủy'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
