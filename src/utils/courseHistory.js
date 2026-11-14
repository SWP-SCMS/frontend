export function isHistoricalCourse(enrollment) {
  if (enrollment.courseRunStatus === 'CANCELLED') return true;
  if (enrollment.lifecycleStatus === 'WITHDRAWAL_PENDING') return false;
  return ['COMPLETED', 'WITHDRAWN', 'TRANSFERRED'].includes(enrollment.lifecycleStatus)
    || ['COMPLETED', 'CANCELLED'].includes(enrollment.courseRunStatus);
}
