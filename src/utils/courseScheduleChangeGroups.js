export function groupCourseScheduleChanges(changes = [], enrollments = []) {
  const owners = new Map(enrollments.flatMap(enrollment => (enrollment.sessions || [])
    .map(session => [session.enrollmentSessionId, enrollment])));
  const units = new Map(enrollments.flatMap(enrollment => (enrollment.sessions || [])
    .map(session => [session.enrollmentSessionId, Number(session.unitNumber)])));
  const unit = change => units.get(change.enrollmentSessionId) > 0 ? units.get(change.enrollmentSessionId) : Infinity;
  const date = change => Date.parse(change.oldStartAt || change.newStartAt) || Infinity;
  const groups = new Map();
  for (const change of changes) {
    const owner = owners.get(change.enrollmentSessionId);
    // Superseded rows remain readable history and never share active response buttons.
    const phase = change.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'CURRENT';
    const key = change.changeEventId
      ? `${change.changeEventId}:${owner?.enrollmentId || ''}:${phase}` : change.id;
    if (!groups.has(key)) groups.set(key, { key, owner, changes: [] });
    groups.get(key).changes.push(change);
  }
  return [...groups.values()].map(group => {
    const ordered = [...group.changes].sort((a, b) =>
      Number(!!b.withdrawalRequestId) - Number(!!a.withdrawalRequestId)
      || Number(['CENTER_SESSION_RESCHEDULE', 'MEMBER_SCHEDULE_CONFLICT'].includes(b.cause)) - Number(['CENTER_SESSION_RESCHEDULE', 'MEMBER_SCHEDULE_CONFLICT'].includes(a.cause))
      || Number(a.cause === 'VOLUNTARY') - Number(b.cause === 'VOLUNTARY') || a.id.localeCompare(b.id));
    const representative = ordered[0];
    const answered = ordered.find(change => change.response);
    const deadline = ordered.map(change => change.responseDeadline).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    const displayChanges = [...group.changes].sort((a, b) => unit(a) - unit(b) || date(a) - date(b) || a.id.localeCompare(b.id));
    return { ...representative, key: group.key, owner: group.owner, changes: displayChanges,
      responseDeadline: deadline,
      response: answered?.response || representative.response,
      status: answered ? answered.status : representative.status,
      respondedAt: answered?.respondedAt || representative.respondedAt,
      withdrawalEligible: ordered.some(change => change.withdrawalEligible),
    };
  });
}

export function applyCourseScheduleGroupResponse(changes, group, result) {
  const ids = new Set(group.changes.map(change => change.id));
  return changes.map(change => !ids.has(change.id) ? change : {
    ...change, ...(change.id === result.id ? result : {}),
    status: result.status, response: result.response, respondedAt: result.respondedAt,
  });
}
