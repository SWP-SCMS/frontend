import { Button, Card, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { useMemberArea } from './MemberAreaContext';

export default function MemberBenefitRouteGuard({ benefitCode, serviceName, children }) {
  const {
    loading,
    error,
    benefitsKnown,
    isBenefitLocked,
    getRequiredPlanLabel,
  } = useMemberArea();
  const requiredPlanLabel = getRequiredPlanLabel(benefitCode);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  // Giữ tương thích an toàn nếu catalogue membership tạm thời không tải được
  // hoặc Backend cũ chưa trả benefitCodes; API vẫn là lớp kiểm tra cuối cùng.
  if (error || !benefitsKnown || !isBenefitLocked(benefitCode)) return children;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4 text-center">
        <h1 className="h4 fw-bold mb-2">Gói tập chưa bao gồm tính năng này</h1>
        <p className="text-muted mb-4">
          “{serviceName}”{requiredPlanLabel
            ? ` có trong gói ${requiredPlanLabel}.`
            : ' yêu cầu một gói tập phù hợp.'}
        </p>
        <Button as={Link} to="/member/plan" variant="danger">
          Xem các gói tập
        </Button>
      </Card.Body>
    </Card>
  );
}
