import Badge from './SystemBadge';

import {
  COURSE_REFUND_STATUS_LABELS,
  courseWithdrawalStatusLabel,
} from '../../utils/courseWorkflow';

const LABELS = {
  refunds: COURSE_REFUND_STATUS_LABELS,
};
export default function CourseWorkflowStatusBadge({ kind, status, refundStatus, className = '' }) {
  return (
    <Badge className={className}>
      {kind === 'withdrawals' ? courseWithdrawalStatusLabel(status, refundStatus) : LABELS[kind]?.[status] || 'Đang cập nhật'}
    </Badge>
  );
}
