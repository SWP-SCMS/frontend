import useTransientNotice from '../../../hooks/useTransientNotice';
import { COURSE_REFUND_SOURCE_LABELS } from "../../../utils/courseWorkflow";
import api from "../../../services/api";
import CancelCourseWithdrawal from "../../member/courses/CancelCourseWithdrawal";
import CourseWorkflowStatusBadge from '../../../components/common/CourseWorkflowStatusBadge';
import usePollingEffect from "../../../hooks/usePollingEffect";
import { useRef, useState } from "react";
import { Alert, Button, Card, Form, Modal, Nav, Table } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseDecisionSchema } from "../../../schemas/courseWorkflowSchemas";
import {
  listAllReceptionCourseEnrollments,
  listAllMemberCourseRefundsForReception,
  requestReceptionCourseWithdrawal,
} from "../../../services/courseWorkflowService";
import {
  COURSE_RUN_STATUS_LABELS,
  formatCourseDateTime,
  formatCourseMoney,
  getCourseErrorMessage,
} from "../../../utils/courseUi";
const reasons = {
  ELIGIBLE_WITH_REFUND: "Được rút, có khoản hoàn",
  ELIGIBLE_WITHOUT_REFUND: "Được rút, không hoàn tiền",
  ENROLLMENT_NOT_ACTIVE: "Đăng ký không hoạt động",
  COURSE_RUN_NOT_WITHDRAWABLE: "Đợt học không cho phép rút",
  FINAL_UNIT_ALREADY_STARTED: "Buổi cuối đã bắt đầu",
};
const tabs = { current: 'Đang học', upcoming: 'Sắp học', history: 'Lịch sử' };
function courseTab(item) {
  if (['CANCELLED', 'COMPLETED', 'SETTLEMENT_PENDING'].includes(item.courseRunStatus)
      || ['WITHDRAWN', 'TRANSFERRED', 'COMPLETED'].includes(item.enrollmentStatus)) return 'history';
  if (['DRAFT', 'OPEN_FOR_REGISTRATION', 'CONFIRMED'].includes(item.courseRunStatus)) return 'upcoming';
  return 'current';
}
function historyLabel(item) {
  if (item.courseRunStatus === 'CANCELLED') return 'Đợt học đã bị hủy';
  if (item.enrollmentStatus === 'WITHDRAWN') return 'Đã rút khóa';
  if (item.enrollmentStatus === 'TRANSFERRED') return 'Đã chuyển đợt';
  if (item.enrollmentStatus === 'COMPLETED') return 'Đã hoàn thành';
  return COURSE_RUN_STATUS_LABELS[item.courseRunStatus] || 'Đã hoàn thành';
}

function RefundCells({ refund }) {
  if (!refund) return <td colSpan={5} className="text-muted">Chưa có khoản hoàn</td>;
  return (
    <>
      <td>{COURSE_REFUND_SOURCE_LABELS[refund.source] || "Hoàn tiền khóa học"}</td>
      <td><CourseWorkflowStatusBadge kind="refunds" status={refund.status} /></td>
      <td className="text-end text-nowrap">{formatCourseMoney(refund.grossObligationVnd)}</td>
      <td className="text-end text-nowrap">{formatCourseMoney(refund.approvedAmountVnd)}</td>
      <td className="text-end text-nowrap">{formatCourseMoney(refund.disbursedAmountVnd)}</td>
    </>
  );
}

export default function ReceptionCourseWithdrawals({
  member,
  refreshRevision,
  onChanged,
}) {
  const [tab, setTab] = useState("current");
  const [page, setPage] = useState(0),
    [data, setData] = useState(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useTransientNotice(""),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false);

  const lock = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(courseDecisionSchema),
    defaultValues: { reason: "" },
  });
  usePollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      let active = true;
      if (!background) commitValue(setData, null);
      commitError(setError, "");
      track(
        Promise.all([
          listAllReceptionCourseEnrollments(member.accountId),
          listAllMemberCourseRefundsForReception(member.accountId),
          api.get(`/reception/members/${member.accountId}/course-withdrawal-requests`),
        ])
          .then(([enrollments, refunds, { data: withdrawals }]) => {
            if (!active) return;
            commitValue(setData, { content: enrollments, withdrawals, refunds });
          })
          .catch((e) => {
            failed(e);
            if (active) commitError(setError, getCourseErrorMessage(e));
          }),
      );
      return () => {
        active = false;
      };
    },
    [member.accountId, revision, refreshRevision],
    !busy,
  );
  const requests = data?.withdrawals || [];
  const pendingByEnrollment = new Map(requests.filter(row => row.status === 'PENDING').map(row => [row.enrollmentId, row]));
  const history = requests.filter(row => row.status !== 'PENDING');
  const groups = { current: [], upcoming: [], history: [] };
  for (const item of data?.content || []) groups[courseTab(item)].push(item);
  const rows = groups[tab];
  const pages = Math.ceil(rows.length / 20);
  const visiblePage = Math.min(page, Math.max(0, pages - 1));
  const visible = rows.slice(visiblePage * 20, (visiblePage + 1) * 20);

  const refundsByEnrollment = new Map();
  for (const refund of data?.refunds || []) {
    if (!refundsByEnrollment.has(refund.enrollmentId)) refundsByEnrollment.set(refund.enrollmentId, []);
    refundsByEnrollment.get(refund.enrollmentId).push(refund);
  }
  const showRefunds = rows.some(item => refundsByEnrollment.has(item.enrollmentId));
  const showActions = tab !== 'history' || rows.some(item => pendingByEnrollment.has(item.enrollmentId));

  async function submit(values) {
    if (lock.current || !selected?.withdrawalEligible) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await requestReceptionCourseWithdrawal(
        member.accountId,
        selected.enrollmentId,
        values.reason,
      );
      setSelected(null);
      setNotice("Đã gửi yêu cầu rút, chờ Quản lý duyệt.");
      onChanged();
    } catch (e) {
      setError(getCourseErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mt-4">
      <h2 className="h5">Khóa học đã đăng ký</h2>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && !selected && <Alert variant="danger">{error}</Alert>}
      <Button disabled={busy} onClick={() => setRevision((v) => v + 1)}>
        Tải lại đăng ký
      </Button>
      {!data && !error && <p>Đang tải…</p>}
      {data && (
        <>
          <Nav variant="tabs" activeKey={tab} onSelect={key => { setTab(key); setPage(0); }} className="my-3">
            {Object.entries(tabs).map(([key, label]) => (
              <Nav.Item key={key}><Nav.Link as="button" eventKey={key}>{label} ({groups[key].length})</Nav.Link></Nav.Item>
            ))}
          </Nav>
          {visible.length > 0 && <Table responsive>
            <thead className="table-light">
              <tr>
                <th>Khóa học</th>
                <th>Mã đợt</th>
                {tab !== 'history' && <th>{tab === 'upcoming' ? 'Ngày khai giảng' : 'Buổi kế tiếp'}</th>}
                <th>Trạng thái đăng ký</th>
                {tab !== 'history' && <th>Hoàn dự kiến</th>}
                {showActions && <th>Thao tác</th>}
                {showRefunds && <>
                  <th>Lý do hoàn</th>
                  <th>Trạng thái hoàn</th>
                  <th className="text-end">Số tiền hoàn</th>
                  <th className="text-end">Đã duyệt</th>
                  <th className="text-end">Đã chi</th>
                </>}
              </tr>
            </thead>
            {visible.map((item) => {
                const pending = pendingByEnrollment.get(item.enrollmentId);
                const awaitingDecision = Boolean(pending) || item.enrollmentStatus === "WITHDRAWAL_PENDING";
                const refunds = refundsByEnrollment.get(item.enrollmentId) || [];
                const span = Math.max(1, refunds.length);
                return (
                <tbody key={item.enrollmentId} className="align-middle">
                <tr>
                  <td rowSpan={span}>{item.courseName}</td>
                  <td rowSpan={span}>{item.runCode}</td>
                  {tab !== 'history' && <td rowSpan={span}>{formatCourseDateTime(tab === 'upcoming' ? item.plannedStartAt : item.nextSessionAt)}</td>}
                  <td rowSpan={span}>{awaitingDecision ? <CourseWorkflowStatusBadge kind="withdrawals" status="PENDING" /> : tab === 'history' ? historyLabel(item) : reasons[item.withdrawalReason] || "Chưa xác định"}
                    {awaitingDecision && <small className="d-block text-muted">Tạm ngừng học/điểm danh, vẫn giữ chỗ.</small>}</td>
                  {tab !== 'history' && <td rowSpan={span}>{formatCourseMoney(pending ? pending.refundAmountVnd : item.estimatedRefundAmount)}</td>}
                  {showActions && <td rowSpan={span}>
                    {pending ? <CancelCourseWithdrawal
                      memberId={member.accountId}
                      request={pending}
                      onCancelled={() => { setNotice("Đã hủy yêu cầu rút."); onChanged(); }}
                    /> : !awaitingDecision && item.withdrawalEligible && tab !== 'history' && <Button
                      disabled={busy || !item.withdrawalEligible}
                      onClick={() => {
                        reset({ reason: "" });
                        setError("");
                        setSelected(item);
                      }}
                    >
                      Yêu cầu rút hộ
                    </Button>}
                  </td>}
                  {showRefunds && <RefundCells refund={refunds[0]} />}
                </tr>
                {refunds.slice(1).map(refund => <tr key={refund.id}><RefundCells refund={refund} /></tr>)}
                </tbody>
                );
              })}
          </Table>}
          {!visible.length && <p>{tab === 'current' ? 'Không có khóa đang học.' : tab === 'upcoming' ? 'Không có khóa sắp học.' : 'Chưa có lịch sử khóa học.'}</p>}
          {pages > 1 && <div>
            <Button disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)}>Trang trước</Button>
            <span className="mx-3">Trang {visiblePage + 1} / {pages}</span>
            <Button disabled={visiblePage + 1 >= pages} onClick={() => setPage(visiblePage + 1)}>Trang sau</Button>
          </div>}
        </>
      )}
      {history.length > 0 && <details className="mt-3">
        <summary>Lịch sử yêu cầu rút ({history.length})</summary>
          {history.map((w) => (
            <Card as="article" body className="mb-3 shadow-sm" key={w.id}>
              <p>
                {w.courseName} · {w.runCode} ·{" "}
                <CourseWorkflowStatusBadge kind="withdrawals" status={w.status} refundStatus={w.refundStatus} />
              </p>
              <p>
                Mức hoàn dự kiến của yêu cầu:{" "}
                {w.snapshotSource === "UNAVAILABLE" || w.refundAmountVnd == null
                  ? "Chưa có dữ liệu"
                  : formatCourseMoney(w.refundAmountVnd)}
              </p>
              {w.learningSuspended && (
                <p>Tạm ngừng học/điểm danh, vẫn giữ chỗ.</p>
              )}
            </Card>
          ))}
      </details>}
      <Modal
        show={!!selected}
        onHide={() => {
          if (!busy) setSelected(null);
        }}
        backdrop={busy ? "static" : true}
        keyboard={!busy}
      >
        <Form noValidate onSubmit={(event) => handleSubmit(submit)(event)}>
          <Modal.Header closeButton={!busy}>
            <Modal.Title>Yêu cầu rút hộ</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <p>
              {member.fullName} · {selected?.courseName} · {selected?.runCode}
            </p>
            <p>
              Hoàn dự kiến: {formatCourseMoney(selected?.estimatedRefundAmount)}
              . Hội viên tạm ngừng học, giữ chỗ khi chờ duyệt và không được bù các buổi đã lỡ.
            </p>
            <Form.Group controlId="reception-withdrawal-reason">
              <Form.Label>Lý do</Form.Label>
              <Form.Control
                as="textarea"
                {...register("reason")}
                disabled={busy}
                isInvalid={!!errors.reason}
              />
              <Form.Control.Feedback type="invalid">
                {errors.reason?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button disabled={busy} type="submit">
              Xác nhận gửi yêu cầu
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </section>
  );
}
