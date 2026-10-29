const END_REASON_LABELS = {
  'Membership terminated': 'Gói hội viên đã chấm dứt.',
};

export function coachAssignmentEndReasonLabel(reason) {
  return END_REASON_LABELS[reason] || reason;
}
