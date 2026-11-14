const VISIBLE_COURSE_STATUSES = new Set(['SCHEDULED', 'MAKEUP_SCHEDULED', 'COMPLETED']);

export function courseTeachingEntries(sessions = []) {
  return sessions.filter(session => session.courseRunStatus !== 'CANCELLED'
    && VISIBLE_COURSE_STATUSES.has(session.sessionStatus)).map(session => ({
    id: `course-${session.courseSessionId}`,
    courseSessionId: session.courseSessionId,
    classType: 'COURSE',
    className: `${session.courseName} · Buổi ${session.unitNumber}`,
    runCode: session.runCode,
    courseRunStatus: session.courseRunStatus,
    startTime: session.startsAt,
    endTime: session.endsAt,
    roomName: session.roomName,
    bookedCount: session.rosterCount,
    status: session.sessionStatus,
  }));
}
