import Badge from './SystemBadge';

import {
  COURSE_REFUND_STATUS_LABELS,
  courseWithdrawalStatusLabel,
  COURSE_TRANSFER_REQUEST_STATUS_LABELS,
} from '../../utils/courseWorkflow';

const LABELS = {
  refunds: COURSE_REFUND_STATUS_LABELS,
  transfers: COURSE_TRANSFER_REQUEST_STATUS_LABELS,
};
export default function CourseWorkflowStatusBadge({ kind, status, refundStatus, className = '' }) {
  return (
    <Badge className={className}>
      {kind === 'withdrawals' ? courseWithdrawalStatusLabel(status, refundStatus) : LABELS[kind]?.[status] || 'Đang cập nhật'}
    </Badge>
  );
}
