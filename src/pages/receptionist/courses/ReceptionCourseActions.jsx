import { groupCourseScheduleChanges } from '../../../utils/courseScheduleChangeGroups';
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
import {
  formatCourseDateTime as date,
  getCourseErrorMessage,
} from "../../../utils/courseUi";
import {
  COURSE_RESPONSE_LABELS,
  canRespondToCourseChange,
} from "../../../utils/courseWorkflow";

export default function ReceptionCourseActions({
  member,
  run,
  afterRegistration = false,
  refreshRevision,
  onChanged,
}) {
  const { confirm, dialog } = useConfirmation();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
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
        api.get(`${base}/${afterRegistration ? 'course-schedule-changes' : 'course-waitlists'}`)
          .then(({ data: rows }) => {
            if (active) commitValue(setData, afterRegistration ? { changes: rows } : { waitlists: rows });
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
    [base, revision, refreshRevision, afterRegistration],
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
  const pendingChanges = [];
  const pastChanges = [];
  const now = Date.now();
  for (const change of groupCourseScheduleChanges(data?.changes)) {
    if (canRespondToCourseChange(change, now)) pendingChanges.push(change);
    else pastChanges.push(change);
  }
  return (
    <section className="mt-4">
      {dialog}
      <h2 className="h5">{afterRegistration ? "Lịch và yêu cầu của hội viên" : "Hàng chờ đăng ký"}</h2>
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
      {data && !afterRegistration && (
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
        </>
      )}
      {data && afterRegistration && (
        <>
          <h3 className="h6 mt-3">Thay đổi lịch chờ phản hồi</h3>
          {!pendingChanges.length && <p>Không có lịch cần phản hồi.</p>}
          {pendingChanges.map((c) => (
            <Card as="article" body className="mb-3 shadow-sm" key={c.key}>
              {c.changes.map(change => <p key={change.id}>{date(change.oldStartAt)} → {date(change.newStartAt)}</p>)}
              <p>Hạn phản hồi: {date(c.responseDeadline)}</p>
              {Object.entries(COURSE_RESPONSE_LABELS).map(
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
                            : `Gửi phản hồi cho toàn bộ lần thay đổi lịch: ${label}.`,
                        )
                      }
                    >
                      {label}
                    </Button>
                  ),
                )}
            </Card>
          ))}
          {pastChanges.length > 0 && (
            <details className="mb-3">
              <summary>Lịch sử đổi lịch ({pastChanges.length})</summary>
              <ul className="mt-2">
                {pastChanges.map(change => (
                  <li key={change.key} className="mb-2">
                    <strong>{change.status === 'SUPERSEDED' ? 'Đã thay thế'
                      : change.response ? (COURSE_RESPONSE_LABELS[change.response] || 'Đã phản hồi')
                      : 'Đã đóng phản hồi'}</strong>
                    {change.changes.map(item => <div key={item.id}>{date(item.oldStartAt)} → {date(item.newStartAt)}</div>)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
