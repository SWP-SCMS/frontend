import SessionTime from '../../../components/common/SessionTime';
import useCourseResourceAvailability from '../../../hooks/useCourseResourceAvailability';
import CourseRunStatusBadge from '../../../components/common/CourseRunStatusBadge';
import { z } from "zod";
import usePollingEffect from "../../../hooks/usePollingEffect";
import CourseRunRescheduleModal from "./CourseRunRescheduleModal";
import SessionDateSlotInput from "../../../components/common/SessionDateSlotInput";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  minimumEnrollmentSchema,
  courseSessionSchema,
} from "../../../schemas/courseSchemas";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import ErrorAlert from "../../../components/common/ErrorAlert";
import { courseMakeupIds } from "../../../utils/courseWorkflow";
import {
  cancelCourseSessionWithMakeup,
  createManagerCourseMakeup,
  getCourseCancellationImpact,
  cancelManagerCourseRun,
  createManagerCourseSession,
  getManagerCourseRun,
  listManagerCourseSessions,
  openManagerCourseRunRegistration,
  updateManagerCourseRun,
  updateManagerCourseSession,
} from "../../../services/courseAdminService";
import {
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorMessage,
  COURSE_SESSION_STATUS_LABELS,
  getCourseStatusLabel,
} from "../../../utils/courseUi";


const toIso = (value) =>
  value ? new Date(`${value}:00+07:00`).toISOString() : null;
const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() + 7 * 60 * 60000).toISOString().slice(0, 16);
};
const emptySession = {
  unitNumber: "",
  roomId: "",
  coachId: "",
  startAt: "",
  endAt: "",
  allocationVnd: "",
};
const DEFAULT_COURSE_POLICY_VERSION = "course-mvp-v1";

export default function ManagerCourseRunDetailPage() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { runId } = useParams();
  const [run, setRun] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState("");
  const [impact, setImpact] = useState(null);
  const cancellationForm = useForm({
    resolver: zodResolver(
      z.object({
        reason: z
          .string()
          .trim()
          .min(5, "Lý do cần ít nhất 5 ký tự.")
          .max(1000, "Lý do không quá 1000 ký tự."),
      }),
    ),
    defaultValues: { reason: "" },
  });

  const [editingSession, setEditingSession] = useState(null);
  const [makeup, setMakeup] = useState(false);
  const minimumForm = useForm({
    resolver: zodResolver(minimumEnrollmentSchema(run?.capacity)),
    defaultValues: { minimumEnrollment: "" },
  });
  const sessionFields = useForm({
    resolver: zodResolver(
      courseSessionSchema(!!editingSession, run?.totalUnits),
    ),
    defaultValues: emptySession,
  });
  const sessionStart = useWatch({ control: sessionFields.control, name: 'startAt' });
  const sessionEnd = useWatch({ control: sessionFields.control, name: 'endAt' });
  const safeIso = value => value && Number.isFinite(Date.parse(`${value}:00+07:00`)) ? toIso(value) : null;
  const availability = useCourseResourceAvailability({
    windows: [{ startAt: safeIso(sessionStart), endAt: safeIso(sessionEnd) }],
    capacity: run?.capacity, enabled: modal === 'session', excludeSessionId: editingSession?.id,
  });
  const { rooms, coaches } = availability;
  const { getValues: getSessionValues, setValue: setSessionValue } = sessionFields;
  useEffect(() => {
    if (!availability.ready) return;
    const roomId = getSessionValues('roomId');
    setSessionValue('roomId', rooms.some(r => r.id === roomId) ? roomId : '');
    const coachId = getSessionValues('coachId');
    setSessionValue('coachId', coaches.some(c => c.accountId === coachId) ? coachId : '');
  }, [availability.ready, rooms, coaches, getSessionValues, setSessionValue]);
  const { reset: resetMinimum } = minimumForm;
  const { reset: setSessionForm } = sessionFields;

  const load = useCallback(
    async ({
      background = false,
      commitValue = (setter, value) => setter(value),
      commitError = (setter, value) => setter(value),
      failed = () => {},
    } = {}) => {
      if (!background) commitValue(setLoading, true);
      commitError(setError, "");
      try {
        const [runData, sessionData] = await Promise.all([
          getManagerCourseRun(runId),
          listManagerCourseSessions(runId),
        ]);
        commitValue(setRun, runData);
        if (!background)
          commitValue(resetMinimum, {
            minimumEnrollment: runData.minimumEnrollment,
          });
        commitValue(setSessions, sessionData);
      } catch (err) {
        failed(err);
        commitError(
          setError,
          getCourseErrorMessage(err, "Không tải được đợt mở khóa học."),
        );
      } finally {
        if (!background) commitValue(setLoading, false);
      }
    },
    [runId, resetMinimum],
  );
  usePollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      track(load({ background, commitValue, commitError, failed }));
    },
    [load],
    !modal && !busy,
  );

  async function saveMinimum({ minimumEnrollment }) {
    setBusy(true);
    setError("");
    try {
      setRun(
        await updateManagerCourseRun(runId, {
          expectedVersion: run.version,
          minimumEnrollment: Number(minimumEnrollment),
        }),
      );
      setModal("");
    } catch (err) {
      setError(
        getCourseErrorMessage(err, "Không cập nhật được số đăng ký tối thiểu."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function openRegistration(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setRun(
        await openManagerCourseRunRegistration(
          runId,
          run.version,
          DEFAULT_COURSE_POLICY_VERSION,
        ),
      );
      setModal("");
    } catch (err) {
      setError(getCourseErrorMessage(err, "Không thể mở đăng ký."));
    } finally {
      setBusy(false);
    }
  }

  async function openCancellation() {
    setModal("cancel");
    setImpact(null);
    setError("");
    cancellationForm.reset({ reason: "" });
    try {
      setImpact(await getCourseCancellationImpact(runId));
    } catch (err) {
      setError(
        getCourseErrorMessage(
          err,
          "Không tải được số lượng bị ảnh hưởng. Vui lòng đóng và thử lại.",
        ),
      );
    }
  }
  async function cancelRun({ reason }) {
    if (busy || !impact) return;
    setBusy(true);
    setError("");
    try {
      setRun(await cancelManagerCourseRun(runId, run.version, reason));
      setModal("");
    } catch (err) {
      setError(getCourseErrorMessage(err, "Không thể hủy đợt mở khóa học."));
    } finally {
      setBusy(false);
    }
  }

  function openNewSession() {
    setMakeup(false);
    setEditingSession(null);
    setSessionForm({ ...emptySession, coachId: run.primaryCoachId });
    setModal("session");
  }
  function openEditSession(item) {
    setMakeup(false);
    setEditingSession(item);
    setSessionForm({
      unitNumber: item.unitNumber,
      roomId: item.roomId || "",
      coachId: item.coachId || "",
      startAt: toLocalInput(item.startAt),
      endAt: toLocalInput(item.endAt),
      allocationVnd: item.allocationVnd || "",
    });
    setModal("session");
  }

  async function saveSession(sessionForm) {
    if (!availability.ready || !rooms.some(r => r.id === sessionForm.roomId)
        || !coaches.some(c => c.accountId === sessionForm.coachId)) return;
    setBusy(true);
    setError("");
    try {
      if (makeup) {
        await (
          editingSession.status === "CANCELLED_PENDING_MAKEUP"
            ? createManagerCourseMakeup
            : cancelCourseSessionWithMakeup
        )(runId, editingSession.id, {
          expectedVersion: editingSession.version,
          roomId: sessionForm.roomId,
          coachId: sessionForm.coachId,
          startAt: toIso(sessionForm.startAt),
          endAt: toIso(sessionForm.endAt),
        });
      } else if (editingSession) {
        await updateManagerCourseSession(runId, editingSession.id, {
          expectedVersion: editingSession.version,
          roomId: sessionForm.roomId || null,
          coachId: sessionForm.coachId || null,
          startAt: toIso(sessionForm.startAt),
          endAt: toIso(sessionForm.endAt),
        });
      } else {
        await createManagerCourseSession(runId, {
          unitNumber: Number(sessionForm.unitNumber),
          roomId: sessionForm.roomId,
          coachId: sessionForm.coachId,
          startAt: toIso(sessionForm.startAt),
          endAt: toIso(sessionForm.endAt),
          allocationVnd: Number(sessionForm.allocationVnd),
        });
      }
      setModal("");
      await load();
    } catch (err) {
      setError(getCourseErrorMessage(err, "Không lưu được buổi học."));
    } finally {
      setBusy(false);
    }
  }

  const operational = [
    "OPEN_FOR_REGISTRATION",
    "CONFIRMED",
    "IN_PROGRESS",
  ].includes(run?.status);
  const makeupIds = courseMakeupIds(sessions);
  if (loading)
    return (
      <div className="text-center py-5">
        <Spinner />
      </div>
    );
  if (!run)
    return (
      <div className="scms-course-workspace">
        <ErrorAlert error={error} title="Không thể tải đợt mở khóa học" />
      </div>
    );

  return (
    <div className="scms-course-workspace">
      <Link to="/manager/course-runs" className="text-decoration-none">
        ← Quay lại danh sách đợt mở
      </Link>
      <Link
        to={"/manager/reports/courses?runId=" + encodeURIComponent(runId)}
        className="ms-3"
      >
        Báo cáo đợt học này
      </Link>
      <div className="d-flex justify-content-between align-items-start mt-2 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h3 mb-0">{run.courseName}</h1>
            <CourseRunStatusBadge status={run.status} />
          </div>
          <p className="text-muted mb-0">{run.runCode}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-secondary"
            disabled={busy || run.status !== "DRAFT"}
            onClick={() => setModal("minimum")}
          >
            Sửa số tối thiểu
          </Button>
          {run.status === "DRAFT" && (
            <Button variant="success" onClick={() => setModal("open")}>
              Mở đăng ký
            </Button>
          )}
          {[
            "DRAFT",
            "OPEN_FOR_REGISTRATION",
            "CONFIRMED",
            "IN_PROGRESS",
          ].includes(run.status) && (
            <Button
              variant="outline-danger"
              disabled={busy}
              onClick={openCancellation}
            >
              Hủy đợt mở
            </Button>
          )}
        </div>
      </div>
      {operational && (
        <Button
          className="mb-3"
          disabled={busy}
          onClick={() => setModal("schedule")}
        >
          Sửa lịch / số buổi đợt học
        </Button>
      )}
      {modal === "schedule" && (
        <CourseRunRescheduleModal
          run={run}
          sessions={sessions}
          onClose={() => setModal("")}
          onSaved={(result) => {
            setRun(result.run);
            setSessions(result.sessions);
            setModal("");
            setError("");
          }}
        />
      )}
      {error && (
        <ErrorAlert
          error={error}
          title="Không thể xử lý đợt mở khóa học"
          onClose={() => setError("")}
        />
      )}
      <Row className="g-3 mb-4">
        <Col lg={8}>
          <div className="card border-0 shadow-sm p-4 h-100">
            <Row className="g-3">
              <Col md={6}>
                <strong>Huấn luyện viên chính</strong>
                <div>{run.primaryCoachName}</div>
              </Col>
              <Col md={3}>
                <strong>Học phí</strong>
                <div>{formatCourseMoney(run.tuitionVnd)}</div>
              </Col>
              <Col md={3}>
                <strong>Sĩ số</strong>
                <div>
                  {run.minimumEnrollment}–{run.capacity}
                </div>
              </Col>
              <Col md={6}>
                <strong>Thời gian đăng ký</strong>
                <div>
                  {formatCourseDateTime(run.registrationOpensAt)} –{" "}
                  {formatCourseDateTime(run.registrationClosesAt)}
                </div>
              </Col>
              <Col md={6}>
                <strong>Thời gian dự kiến</strong>
                <div>
                  {formatCourseDateTime(run.plannedStartAt)} –{" "}
                  {formatCourseDateTime(run.plannedEndAt)}
                </div>
              </Col>
            </Row>
          </div>
        </Col>
        <Col lg={4}>
          <div className="card border-0 shadow-sm p-4">
            <strong>Số buổi</strong>
            <div className="display-6">{run.totalUnits}</div>
          </div>
        </Col>
      </Row>

      <div className="card border-0 shadow-sm p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0">Lịch buổi học</h2>
          <Button variant="danger" size="sm" onClick={openNewSession}
            disabled={busy || ["CANCELLED", "COMPLETED", "SETTLEMENT_PENDING"].includes(run.status)}>
            + Thêm buổi học
          </Button>
        </div>
        <Table responsive hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Buổi</th>
              <th>Thời gian</th>
              <th>Phòng</th>
              <th>Huấn luyện viên</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((item) => (
              <tr key={item.id}>
                <td>{item.unitNumber}</td>
                <td>
                  <SessionTime startAt={item.startAt} endAt={item.endAt} />
                </td>
                <td>{item.roomName || "—"}</td>
                <td>{item.coachName || "—"}</td>
                <td>
                  {getCourseStatusLabel(
                    COURSE_SESSION_STATUS_LABELS,
                    item.status,
                  )}
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={
                      busy ||
                      ["CANCELLED", "COMPLETED", "SETTLEMENT_PENDING"].includes(run.status) ||
                      !["SCHEDULED", "MAKEUP_SCHEDULED"].includes(item.status)
                    }
                    onClick={() => openEditSession(item)}
                  >
                    Chỉnh sửa
                  </Button>
                  {operational &&
                    item.status === "SCHEDULED" &&
                    !item.isMakeup &&
                    !makeupIds.has(item.id) && (
                      <Button
                        className="ms-2"
                        size="sm"
                        variant="outline-danger"
                        disabled={busy || Date.parse(item.startAt) <= now}
                        onClick={() => {
                          openEditSession(item);
                          setMakeup(true);
                          setSessionForm({
                            ...sessionFields.getValues(),
                            startAt: "",
                            endAt: "",
                          });
                        }}
                      >
                        Hủy và xếp bù
                      </Button>
                    )}
                  {operational &&
                    item.status === "CANCELLED_PENDING_MAKEUP" &&
                    !item.replacementSessionId &&
                    !makeupIds.has(item.id) && (
                      <Button
                        className="ms-2"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          openEditSession(item);
                          setMakeup(true);
                          setSessionForm({
                            ...sessionFields.getValues(),
                            startAt: "",
                            endAt: "",
                          });
                        }}
                      >
                        Xếp buổi bù
                      </Button>
                    )}
                  {item.replacementSessionId && (
                    <small className="d-block">Đã liên kết buổi bù</small>
                  )}
                </td>
              </tr>
            ))}
            {!sessions.length && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  Chưa có lịch buổi học.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <Modal
        show={modal === "cancel"}
        onHide={() => {
          if (!busy) setModal("");
        }}
        backdrop={busy ? "static" : true}
        keyboard={!busy}
        centered
      >
        <Form onSubmit={cancellationForm.handleSubmit(cancelRun)}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>Hủy đợt học {run.runCode}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ErrorAlert error={error} title="Không thể hủy đợt học" />
            <p>
              {run.courseName} · {run.runCode}
            </p>
            {impact ? (
              <p>
                {impact.enrollmentCount} đăng ký đang học/chờ rút và{" "}
                {impact.pendingOrderCount} đơn chờ thanh toán bị ảnh hưởng.
              </p>
            ) : (
              <p>Đang tải số lượng bị ảnh hưởng…</p>
            )}
            <p>
              Các buổi học sẽ bị hủy, đơn chờ sẽ hết hạn. Khoản hoàn được hệ
              thống xác định và cần xử lý riêng. Số lượng có thể thay đổi đến
              khi xác nhận.
            </p>
            <Form.Label htmlFor="cancel-run-reason">Lý do hủy</Form.Label>
            <Form.Control
              as="textarea"
              id="cancel-run-reason"
              maxLength={1000}
              disabled={busy}
              {...cancellationForm.register("reason")}
              isInvalid={!!cancellationForm.formState.errors.reason}
            />
            <Form.Control.Feedback type="invalid">
              {cancellationForm.formState.errors.reason?.message}
            </Form.Control.Feedback>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={busy}
              onClick={() => setModal("")}
            >
              Quay lại
            </Button>
            <Button variant="danger" type="submit" disabled={busy || !impact}>
              {busy ? "Đang hủy…" : "Xác nhận hủy đợt học"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        show={modal === "minimum"}
        onHide={() => {
          if (!busy) setModal("");
        }}
        backdrop={busy ? "static" : true}
        keyboard={!busy}
        centered
      >
        <Form noValidate onSubmit={minimumForm.handleSubmit(saveMinimum)}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>Sửa số đăng ký tối thiểu</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && (
              <ErrorAlert error={error} title="Không thể lưu thay đổi" />
            )}
            <Form.Label htmlFor="run-minimum">
              Số đăng ký tối thiểu *
            </Form.Label>
            <Form.Control
              id="run-minimum"
              required
              type="number"
              min={1}
              max={run.capacity}
              {...minimumForm.register("minimumEnrollment")}
              isInvalid={!!minimumForm.formState.errors.minimumEnrollment}
            />
            <Form.Control.Feedback type="invalid" className="d-block">
              {minimumForm.formState.errors.minimumEnrollment?.message}
            </Form.Control.Feedback>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={busy}
              onClick={() => setModal("")}
            >
              Hủy
            </Button>
            <Button variant="danger" type="submit" disabled={busy}>
              Lưu
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        show={modal === "open"}
        onHide={() => {
          if (!busy) setModal("");
        }}
        backdrop={busy ? "static" : true}
        keyboard={!busy}
        centered
      >
        <Form onSubmit={openRegistration}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>Mở đăng ký</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <ErrorAlert error={error} title="Không thể mở đăng ký" />}
            <p className="mb-0">
              Bạn muốn mở đăng ký cho đợt học <strong>{run.runCode}</strong>?
              {" "}Hội viên có thể đăng ký trong thời gian đăng ký đã thiết lập.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={busy}
              onClick={() => setModal("")}
            >
              Hủy
            </Button>
            <Button variant="success" type="submit" disabled={busy}>
              Xác nhận mở đăng ký
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      <Modal
        show={modal === "session"}
        onHide={() => {
          if (!busy) setModal("");
        }}
        backdrop={busy ? "static" : true}
        keyboard={!busy}
        centered
        size="lg"
      >
        <Form noValidate onSubmit={sessionFields.handleSubmit(saveSession)}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>
              {makeup
                ? `Xếp bù buổi ${editingSession.unitNumber}`
                : editingSession
                  ? `Chỉnh sửa buổi ${editingSession.unitNumber}`
                  : "Thêm buổi học"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && (
              <ErrorAlert error={error} title="Không thể lưu thay đổi" />
            )}
            {availability.loading && <p role="status">Đang kiểm tra HLV và phòng…</p>}
            {availability.error && <><ErrorAlert error={availability.error} title="Không tải được HLV và phòng trống"/><Button onClick={availability.retry}>Thử lại</Button></>}
            <Row className="g-3">
              {!editingSession && (
                <Col md={4}>
                  <Form.Label htmlFor="course-session-unitNumber">
                    Số thứ tự buổi *
                  </Form.Label>
                  <Form.Control
                    id="course-session-unitNumber"
                    required
                    type="number"
                    min={1}
                    max={run.totalUnits}
                    {...sessionFields.register("unitNumber")}
                    isInvalid={!!sessionFields.formState.errors.unitNumber}
                  />
                  <Form.Control.Feedback type="invalid" className="d-block">
                    {sessionFields.formState.errors.unitNumber?.message}
                  </Form.Control.Feedback>
                </Col>
              )}
              <Col xs={12}><SessionDateSlotInput control={sessionFields.control} /></Col>
              <Col md={editingSession ? 6 : 4}>
                <Form.Label htmlFor="course-session-roomId">Phòng *</Form.Label>
                <Form.Select
                  id="course-session-roomId"
                  disabled={!availability.ready}
                  required
                  {...sessionFields.register("roomId")}
                  isInvalid={!!sessionFields.formState.errors.roomId}
                >
                  <option value="">{!availability.ready ? 'Nhập ngày giờ để tìm phòng' : rooms.length ? '-- Chọn phòng --' : 'Không có phòng phù hợp'}</option>
                  {rooms.map((room) => (
                    <option
                      key={room.id}
                      value={room.id}
                    >
                      {room.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" className="d-block">
                  {sessionFields.formState.errors.roomId?.message}
                </Form.Control.Feedback>
              </Col>
              <Col md={editingSession ? 6 : 4}>
                <Form.Label htmlFor="course-session-coachId">
                  Huấn luyện viên *
                </Form.Label>
                <Form.Select
                  id="course-session-coachId"
                  disabled={!availability.ready}
                  required
                  {...sessionFields.register("coachId")}
                  isInvalid={!!sessionFields.formState.errors.coachId}
                >
                  <option value="">{!availability.ready ? 'Nhập ngày giờ để tìm HLV' : coaches.length ? '-- Chọn huấn luyện viên --' : 'Không có HLV phù hợp'}</option>
                  {coaches.map((coach) => (
                    <option key={coach.accountId} value={coach.accountId}>
                      {coach.fullName || coach.name || coach.email}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid" className="d-block">
                  {sessionFields.formState.errors.coachId?.message}
                </Form.Control.Feedback>
              </Col>
              {!editingSession && (
                <Col md={6}>
                  <Form.Label htmlFor="course-session-allocationVnd">
                    Học phí phân bổ (VND) *
                  </Form.Label>
                  <Form.Control
                    id="course-session-allocationVnd"
                    required
                    type="number"
                    min={1}
                    {...sessionFields.register("allocationVnd")}
                    isInvalid={!!sessionFields.formState.errors.allocationVnd}
                  />
                  <Form.Control.Feedback type="invalid" className="d-block">
                    {sessionFields.formState.errors.allocationVnd?.message}
                  </Form.Control.Feedback>
                </Col>
              )}
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={busy}
              onClick={() => setModal("")}
            >
              Hủy
            </Button>
            <Button variant="danger" type="submit" disabled={busy || !availability.ready || !rooms.length || !coaches.length}>
              Lưu buổi học
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
