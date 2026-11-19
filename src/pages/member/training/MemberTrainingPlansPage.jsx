import useCachedPollingEffect from "../../../hooks/useCachedPollingEffect";
import { useState } from "react";
import { Accordion, Card, Spinner } from "react-bootstrap";

import EmptyState from "../../../components/common/EmptyState";
import Badge from "../../../components/common/SystemBadge";
import ErrorAlert from "../../../components/common/ErrorAlert";
import TrainingContent from "../../../components/common/TrainingContent";
import { listMyTrainingPlans } from "../../../services/trainingService";
import { formatGymDate, formatGymTime } from "../../../utils/gymTime";

export default function MemberTrainingPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useCachedPollingEffect(
    ({ background, track, commitValue, commitError, failed }) => {
      let cancelled = false;
      track(
        listMyTrainingPlans()
          .then((data) => {
            if (!cancelled) commitValue(setPlans, data);
          })
          .catch((err) => {
            failed(err);
            if (!cancelled) commitError(setError, err);
          })
          .finally(() => {
            if (!cancelled) if (!background) commitValue(setLoading, false);
          }),
      );
      return () => {
        cancelled = true;
      };
    },
    [],
    { key: ["member-plans"], setters: [setPlans], setLoading },
  );
  return (
    <div>
      <h1 className="h3 fw-bold">Giáo án tập luyện</h1>
      <p className="text-muted">
        Tập theo phiên bản đang áp dụng. Các phiên bản cũ được giữ lại để tham khảo.
      </p>
      <ErrorAlert error={error} title="Không tải được giáo án" />
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="Chưa có giáo án"
          message="Huấn luyện viên chưa tạo giáo án cho bạn."
        />
      ) : (
        [...plans]
          .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE"))
          .map((plan) => <TrainingPlanCard key={plan.id} plan={plan} />)
      )}
    </div>
  );
}

function TrainingPlanCard({ plan }) {
  const versions = [...(plan.versions || [])].sort(
    (a, b) => Number(b.versionNumber) - Number(a.versionNumber),
  );
  const active = plan.status === "ACTIVE";
  const current = active ? versions[0] : null;
  const history = current ? versions.slice(1) : versions;

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <h2 className="h5 mb-0">{plan.title}</h2>
          {!active && <Badge tone="neutral">Đã lưu trữ</Badge>}
        </div>
        <div className="small text-muted mb-3">
          Cập nhật {formatGymDate(plan.updatedAt)} {formatGymTime(plan.updatedAt)}
        </div>
        {current && (
          <section className="border rounded p-3 mb-3" aria-label="Phiên bản đang áp dụng">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <h3 className="h6 mb-0">Phiên bản {current.versionNumber}</h3>
              <Badge tone="green">Đang áp dụng</Badge>
            </div>
            <TrainingContent value={current.content} />
          </section>
        )}
        {history.length > 0 && (
          <details>
            <summary className="fw-semibold">Lịch sử phiên bản ({history.length})</summary>
            <Accordion className="mt-2">
              {history.map((version) => (
                <Accordion.Item key={version.id} eventKey={String(version.versionNumber)}>
                  <Accordion.Header>
                    <span className="d-flex flex-wrap align-items-center gap-2">
                      <span>Phiên bản {version.versionNumber}</span>
                      <Badge tone="neutral">{active ? "Đã thay thế" : "Đã lưu trữ"}</Badge>
                    </span>
                  </Accordion.Header>
                  <Accordion.Body>
                    <TrainingContent value={version.content} />
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          </details>
        )}
        {versions.length === 0 && <p className="text-muted mb-0">Chưa có phiên bản giáo án.</p>}
      </Card.Body>
    </Card>
  );
}
