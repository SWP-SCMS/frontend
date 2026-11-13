import useCachedPollingEffect from "../../../hooks/useCachedPollingEffect";
import { useCallback, useState } from "react";
import { Button, Card, Spinner } from "react-bootstrap";
import EmptyState from "../../../components/common/EmptyState";
import ErrorAlert from "../../../components/common/ErrorAlert";
import TrainingContent from "../../../components/common/TrainingContent";
import { listMyTrainingResults } from "../../../services/trainingService";
import { formatGymDate, formatGymTime } from "../../../utils/gymTime";

const titles = { COURSE: "Kết quả khóa học", CLASS: "Kết quả lớp học", PT: "Kết quả PT 1-1" };

export default function MemberTrainingResultsPage({ type }) {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(
    async ({
      background = false,
      commitValue = (setter, value) => setter(value),
      commitError = (setter, value) => setter(value),
      failed = () => {},
    } = {}) => {
      if (!background) commitValue(setLoading, true);
      commitError(setError, null);
      try {
        commitValue(setResult, await listMyTrainingResults({ type, page, size: 20 }));
      } catch (err) {
        failed(err);
        commitError(setError, err);
      } finally {
        if (!background) commitValue(setLoading, false);
      }
    },
    [type, page],
  );
  useCachedPollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      track(load({ background, commitValue, commitError, failed }));
    },
    [load],
    { key: ["member-results", type, page], setters: [setResult], setLoading },
  );
  return (
    <div>
      <h1 className="h3 fw-bold">{titles[type]}</h1>
      <p className="text-muted">Lịch sử kết quả do huấn luyện viên ghi nhận.</p>
      <ErrorAlert error={error} title="Không tải được kết quả" />
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : !result?.content.length ? (
        <EmptyState
          title="Chưa có kết quả"
          message="Chưa có kết quả tập luyện nào được ghi nhận."
        />
      ) : (
        <Card className="shadow-sm">
          <ul className="list-group list-group-flush">
            {result.content.map(item => {
              const time = item.sessionStartTime || item.activityAt;
              return (
                <li key={item.id} className="list-group-item py-3 text-break">
                  <div className="small text-muted">{formatGymDate(time)} · {formatGymTime(time)}</div>
                  <h2 className="h6 fw-semibold mt-1 mb-1">{item.sessionName || item.className || "Buổi PT 1-1"}</h2>
                  {item.runCode && <div>Đợt {item.runCode} · Buổi {item.unitNumber}</div>}
                  <div className="small text-muted mb-2">HLV {item.coachName || "—"}</div>
                  <TrainingContent value={item.content} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {(result?.totalPages || 0) > 1 ? (
        <div className="d-flex justify-content-between mt-3">
          <Button
            size="sm"
            variant="outline-danger"
            disabled={loading || page <= 0}
            onClick={() => setPage((v) => v - 1)}
          >
            ‹ Trang trước
          </Button>
          <span className="small text-muted align-self-center">
            Trang {page + 1}/{result.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline-danger"
            disabled={loading || page + 1 >= result.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Trang sau ›
          </Button>
        </div>
      ) : null}
    </div>
  );
}
