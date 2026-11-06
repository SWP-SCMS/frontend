import Badge from './SystemBadge';

import { COURSE_RUN_STATUS_LABELS, getCourseStatusLabel } from '../../utils/courseUi';

export default function CourseRunStatusBadge({ status }) {
  return (
    <Badge>
      {getCourseStatusLabel(COURSE_RUN_STATUS_LABELS, status)}
    </Badge>
  );
}
