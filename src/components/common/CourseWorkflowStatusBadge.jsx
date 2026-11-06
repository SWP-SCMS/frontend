import Badge from './SystemBadge';

import {
  COURSE_REFUND_STATUS_LABELS,
  COURSE_WITHDRAWAL_STATUS_LABELS,
  COURSE_TRANSFER_REQUEST_STATUS_LABELS,
} from '../../utils/courseWorkflow';

const LABELS = {
  refunds: COURSE_REFUND_STATUS_LABELS,
  withdrawals: COURSE_WITHDRAWAL_STATUS_LABELS,
  transfers: COURSE_TRANSFER_REQUEST_STATUS_LABELS,
};
export default function CourseWorkflowStatusBadge({ kind, status, className = '' }) {
  return (
    <Badge className={className}>
      {LABELS[kind]?.[status] || 'Đang cập nhật'}
    </Badge>
  );
}
