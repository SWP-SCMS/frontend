import usePollingEffect from "../../../hooks/usePollingEffect";
import { useRef, useState } from "react";
import { Alert, Button, Form, Modal, Table } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseDecisionSchema } from "../../../schemas/courseWorkflowSchemas";
import {
  listReceptionCourseEnrollments,
  requestReceptionCourseWithdrawal,
} from "../../../services/courseWorkflowService";
import {
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
export default function ReceptionCourseWithdrawals({
  member,
  refreshRevision,
  onChanged,
}) {
  const [page, setPage] = useState(0),
    [data, setData] = useState(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
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
        listReceptionCourseEnrollments(member.accountId, page)
          .then((v) => {
            if (active) commitValue(setData, v);
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
    [member.accountId, page, revision, refreshRevision],
    !busy,
  );
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
      <h2 className="h5">Đăng ký khóa học / rút hộ</h2>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && !selected && <Alert variant="danger">{error}</Alert>}
      <Button disabled={busy} onClick={() => setRevision((v) => v + 1)}>
        Tải lại đăng ký
      </Button>
      {!data && !error && <p>Đang tải…</p>}
      {data && (
        <>
          <Table responsive>
            <thead className="table-light">
              <tr>
                <th>Khóa học</th>
                <th>Điều kiện rút</th>
                <th>Hoàn dự kiến</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.content.map((item) => (
                <tr key={item.enrollmentId}>
                  <td>
                    {item.courseName} · {item.runCode}
                  </td>
                  <td>{reasons[item.withdrawalReason] || "Chưa xác định"}</td>
                  <td>{formatCourseMoney(item.estimatedRefundAmount)}</td>
                  <td>
                    <Button
                      disabled={busy || !item.withdrawalEligible}
                      onClick={() => {
                        reset({ reason: "" });
                        setError("");
                        setSelected(item);
                      }}
                    >
                      Yêu cầu rút hộ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {!data.content.length && <p>Chưa có đăng ký khóa học.</p>}
        </>
      )}
      <Button disabled={!page || busy} onClick={() => setPage(page - 1)}>
        Trang trước
      </Button>
      <span className="mx-3">Trang {page + 1}</span>
      <Button
        disabled={busy || !data || page + 1 >= data.totalPages}
        onClick={() => setPage(page + 1)}
      >
        Trang sau
      </Button>
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
