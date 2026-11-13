import CourseWorkflowStatusBadge from '../../../components/common/CourseWorkflowStatusBadge';
import Badge from '../../../components/common/SystemBadge';
import useConfirmation from "../../../hooks/useConfirmation";
import usePollingEffect from "../../../hooks/usePollingEffect";
import { useRef, useState } from "react";
import { Alert, Button, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import api from "../../../services/api";
import {
  courseIdempotencyConfig,
  createCourseIdempotencyKey,
} from "../../../services/courseServiceUtils";
import CancelCourseWithdrawal from "../../member/courses/CancelCourseWithdrawal";
import {
  formatCourseMoney as money,
  formatCourseDateTime as date,
  getCourseErrorMessage,
} from "../../../utils/courseUi";
import {
  COURSE_TRANSFER_STATUS_LABELS,
  COURSE_REFUND_STATUS_LABELS,
  COURSE_RESPONSE_LABELS,
  canRespondToCourseChange,
  canAcceptCourseTransfer,
} from "../../../utils/courseWorkflow";

export default function ReceptionCourseActions({
  member,
  run,
  refreshRevision,
  onChanged,
}) {
  const { confirm, dialog } = useConfirmation();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(0),
    [orderId, setOrderId] = useState(null);
  const keys = useRef({}),
    lock = useRef(false);
  const base = `/reception/members/${member.accountId}`;
  usePollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      let active = true;
      if (!background) commitValue(setData, null);
      commitError(setError, "");
      track(
        Promise.all(
          [
            "course-waitlists",
            "course-schedule-changes",
            "course-transfer-offers",
            "course-withdrawal-requests",
            `course-refund-obligations?page=${page}&size=20`,
          ].map((path) => api.get(`${base}/${path}`).then((r) => r.data)),
        )
          .then(([waitlists, changes, offers, withdrawals, refunds]) => {
            if (active)
              commitValue(setData, {
                waitlists,
                changes,
                offers,
                withdrawals,
                refunds,
              });
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
    [base, revision, page, refreshRevision],
    !busy,
  );
  async function act(
    path,
    payload,
    keyed = false,
    method = "post",
    confirmation = "Xác nhận thao tác khóa học",
  ) {
    if (lock.current || member.status !== "ACTIVE") return;
    if (
      !(await confirm(`${confirmation}
Hội viên: ${member.fullName} · ${member.memberId}. Tiếp tục?`))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const config = keyed
        ? courseIdempotencyConfig(
            (keys.current[path] ||=
              createCourseIdempotencyKey("reception-course")),
          )
        : undefined;
      const r =
        method === "delete"
          ? await api.delete(`${base}/${path}`)
          : await api.post(`${base}/${path}`, payload, config);
      if (r.data.orderId || r.data.differenceOrderId)
        setOrderId(r.data.orderId || r.data.differenceOrderId);
      onChanged();
    } catch (e) {
      setError(
        getCourseErrorMessage(
          e,
          "Chưa xác nhận kết quả. Tải lại trước khi thử lại.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const paymentLink = (id) =>
    `/reception/courses?orderId=${encodeURIComponent(id)}&memberCode=${encodeURIComponent(member.memberId)}`;
  const disabled = busy || member.status !== "ACTIVE";
  return (
    <section className="mt-4">
      {dialog}
      <h2 className="h5">Thao tác khóa học hộ {member.fullName}</h2>
      <Button
        variant="outline-danger"
        className="me-2 mb-2"
        disabled={busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        Tải lại
      </Button>
      {run && (
        <Button
          className="ms-2"
          disabled={disabled}
          onClick={() =>
            act(
              `course-runs/${run.id}/waitlist`,
              undefined,
              false,
              "post",
              `Vào danh sách chờ đợt ${run.runCode}.`,
            )
          }
        >
          Vào danh sách chờ · {run.runCode}
        </Button>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {orderId && (
        <Alert variant="info">
          <Link to={paymentLink(orderId)}>
            Mở đơn để thanh toán tiền mặt/chuyển khoản
          </Link>
        </Alert>
      )}
      {!data && !error && <p>Đang tải…</p>}
      {data && (
        <>
          <h3 className="h6 mt-3">Danh sách chờ</h3>
          {!data.waitlists.length && <p>Chưa có yêu cầu.</p>}
          {data.waitlists.map((w) => (
            <Card as="article" body className="mb-3 shadow-sm" key={w.id}>
              <p>
                {w.courseName} · {w.runCode} · Vị trí {w.position ?? "—"} · Hạn
                mời {date(w.invitationExpiresAt)}
              </p>
              {["WAITING", "INVITED"].includes(w.status) && (
                <Button
                  variant="outline-danger"
                  className="me-2 mb-2"
                  disabled={disabled}
                  onClick={() =>
                    act(
                      `course-runs/${w.courseRunId}/waitlist`,
                      undefined,
                      false,
                      "delete",
                      `Rời danh sách chờ đợt ${w.runCode}; hội viên sẽ mất vị trí/lời mời hiện tại.`,
                    )
                  }
                >
                  Rời danh sách chờ
                </Button>
              )}
              {["INVITED", "ACCEPTED"].includes(w.status) && (
                <Button
                  variant="outline-danger"
                  className="me-2 mb-2"
                  disabled={disabled}
                  onClick={() =>
                    act(
                      `course-waitlists/${w.id}/accept`,
                      undefined,
                      true,
                      "post",
                      `Nhận chỗ hoặc mở lại đơn thanh toán đợt ${w.runCode}.`,
                    )
                  }
                >
                  Nhận chỗ / mở đơn
                </Button>
              )}
            </Card>
          ))}
          <h3 className="h6 mt-3">Thay đổi lịch</h3>
          {!data.changes.length && <p>Chưa có thay đổi.</p>}
          {data.changes.map((c) => (
            <Card as="article" body className="mb-3 shadow-sm" key={c.id}>
              <p>
                {date(c.oldStartAt)} → {date(c.newStartAt)} · Hạn{" "}
                {date(c.responseDeadline)}
              </p>
              {canRespondToCourseChange(c) &&
                Object.entries(COURSE_RESPONSE_LABELS).map(
                  ([response, label]) => (
                    <Button
                      className="m-1"
                      key={response}
                      disabled={
                        disabled ||
                        (response === "REQUEST_WITHDRAWAL" &&
                          !c.withdrawalEligible)
                      }
                      onClick={() =>
                        act(
                          `course-schedule-changes/${c.id}/response`,
                          { response },
                          false,
                          "post",
                          response === "REQUEST_WITHDRAWAL"
                            ? "Yêu cầu rút sẽ tạm ngừng học/điểm danh, vẫn giữ chỗ khi chờ duyệt. Nếu hủy hoặc bị từ chối, các buổi đã lỡ không được học bù."
                            : `Gửi phản hồi: ${label}.`,
                        )
                      }
                    >
                      {label}
                    </Button>
                  ),
                )}
            </Card>
          ))}
          <h3 className="h6 mt-3">Đề nghị chuyển đợt</h3>
          {!data.offers.length && <p>Chưa có đề nghị.</p>}
          {data.offers.map((o) => (
            <Card as="article" body className="mb-3 shadow-sm" key={o.id}>
              <p>
                {o.sourceCourseName} · {o.sourceRunCode} → {o.targetCourseName}{" "}
                · {o.targetRunCode}
              </p>
              <p>
                <Badge>{COURSE_TRANSFER_STATUS_LABELS[o.status] || "Đang cập nhật"}</Badge> ·
                Chênh lệch {money(o.differenceVnd)} · Hạn {date(o.expiresAt)}
              </p>
              <Link to={`/course-runs/${o.targetRunId}`}>Xem đợt học</Link>
              {canAcceptCourseTransfer(o) && (
                <Button
                  variant="outline-danger"
                  className="me-2 mb-2"
                  disabled={disabled}
                  onClick={() =>
                    act(
                      `course-transfer-offers/${o.id}/accept`,
                      undefined,
                      true,
                      "post",
                      `Chấp nhận chuyển từ ${o.sourceRunCode} sang ${o.targetRunCode}. Chênh lệch học phí: ${money(o.differenceVnd)}. Nếu có khoản cần đóng thêm, phải hoàn tất thanh toán theo đơn của hệ thống.`,
                    )
                  }
                >
                  Chấp nhận chuyển hộ
                </Button>
              )}
              {o.differenceOrderId && (
                <Link className="ms-2" to={paymentLink(o.differenceOrderId)}>
                  Thanh toán chênh lệch
                </Link>
              )}
            </Card>
          ))}
          <h3 className="h6 mt-3">Lịch sử yêu cầu rút</h3>
          {!data.withdrawals.length && <p>Chưa có yêu cầu.</p>}
          {data.withdrawals.map((w) => (
            <Card as="article" body className="mb-3 shadow-sm" key={w.id}>
              <p>
                {w.courseName} · {w.runCode} ·{" "}
                <CourseWorkflowStatusBadge kind="withdrawals" status={w.status} refundStatus={w.refundStatus} />
              </p>
              <p>
                Khoản hoàn đã ghi nhận:{" "}
                {w.snapshotSource === "UNAVAILABLE" || w.refundAmountVnd == null
                  ? "Chưa có dữ liệu"
                  : money(w.refundAmountVnd)}
              </p>
              {w.learningSuspended && (
                <p>Tạm ngừng học/điểm danh, vẫn giữ chỗ.</p>
              )}
              <CancelCourseWithdrawal
                memberId={member.accountId}
                request={w}
                onCancelled={onChanged}
              />
            </Card>
          ))}
          <h3 className="h6 mt-3">Lịch sử hoàn tiền</h3>
          {!data.refunds.items?.length && (
            <p>Chưa có khoản hoàn trong trang này.</p>
          )}
          {data.refunds.items?.map((r) => (
            <p key={r.id}>
              <Badge>{COURSE_REFUND_STATUS_LABELS[r.status] || "Đang cập nhật"}</Badge> · Nghĩa
              vụ {money(r.grossObligationVnd)} · Đã duyệt{" "}
              {money(r.approvedAmountVnd)} · Đã chi{" "}
              {money(r.disbursedAmountVnd)}
            </p>
          ))}
          <Button
            variant="outline-danger"
            className="me-2 mb-2"
            disabled={busy || page === 0}
            onClick={() => setPage(page - 1)}
          >
            Trang hoàn trước
          </Button>
          <span className="mx-2">{page + 1}</span>
          <Button
            variant="outline-danger"
            className="me-2 mb-2"
            disabled={busy || page + 1 >= data.refunds.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Trang hoàn sau
          </Button>
        </>
      )}
    </section>
  );
}
