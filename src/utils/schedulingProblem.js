function uniqueSessionIds(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ];
}

export function extractAffectedSessions(problem) {
  const structured = Array.isArray(problem?.affectedSessions)
    ? problem.affectedSessions
        .filter(
          (session) =>
            session &&
            typeof session === 'object' &&
            typeof session.sessionId === 'string' &&
            session.sessionId.trim(),
        )
        .map((session) => ({
          sessionId: session.sessionId.trim(),
          classId: session.classId || null,
          className: session.className || null,
          startTime: session.startTime || null,
          endTime: session.endTime || null,
        }))
    : [];
  if (structured.length > 0) return structured;

  const topLevelIds = uniqueSessionIds(problem?.affectedSessionIds);
  if (topLevelIds.length > 0) {
    return topLevelIds.map((sessionId) => ({ sessionId }));
  }

  const raw = problem?.errors?.affectedSessionIds;
  const messages = Array.isArray(raw) ? [...raw] : raw == null ? [] : [raw];
  const detail = problem?.detail || problem?.message;
  if (detail) messages.push(detail);
  const uuidPattern =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
  return uniqueSessionIds(
    messages.flatMap((value) => String(value).match(uuidPattern) || []),
  ).map((sessionId) => ({ sessionId }));
}

export function hasAffectedSessionPayload(problem) {
  const fieldErrors = problem?.errors;
  return (
    Array.isArray(problem?.affectedSessions) ||
    Array.isArray(problem?.affectedSessionIds) ||
    (fieldErrors != null &&
      typeof fieldErrors === 'object' &&
      Object.prototype.hasOwnProperty.call(fieldErrors, 'affectedSessionIds'))
  );
}
