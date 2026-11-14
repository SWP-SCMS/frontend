const VN_OFFSET = 7 * 3600000;
const DAY = 86400000;
const local = value => new Date(value + VN_OFFSET);
const input = value => local(value).toISOString().slice(0, 16);

// Weekly patterns are reconstructed from the purchased units' original timetable.
// Existing makeups extend the tail but never add weekdays to that pattern.
export function suggestCourseMakeup(sessions = [], now = Date.now()) {
  const regular = sessions.filter(s => !s.isMakeup && !s.originalSessionId && s.status !== 'REMOVED_BY_RUN_CHANGE'
    && Number.isFinite(Date.parse(s.originalStartAt || s.startAt)) && Number.isFinite(Date.parse(s.originalEndAt || s.endAt)));
  if (!regular.length) return null;
  const pattern = new Map();
  for (const session of [...regular].sort((a, b) => Date.parse(a.originalStartAt || a.startAt) - Date.parse(b.originalStartAt || b.startAt))) {
    const start = Date.parse(session.originalStartAt || session.startAt);
    const end = Date.parse(session.originalEndAt || session.endAt);
    if (end > start) pattern.set(local(start).getUTCDay(), { start, duration: end - start });
  }
  const tail = sessions.filter(s => s.status !== 'REMOVED_BY_RUN_CHANGE'
    && (!s.isMakeup && !s.originalSessionId || ['SCHEDULED', 'MAKEUP_SCHEDULED', 'COMPLETED'].includes(s.status)))
    .map(s => Date.parse(s.endAt)).filter(Number.isFinite);
  const after = Math.max(now, ...tail);
  const day = local(after); day.setUTCHours(0, 0, 0, 0);
  for (let offset = 1; offset <= 7; offset++) {
    const date = new Date(day.getTime() + offset * DAY);
    const slot = pattern.get(date.getUTCDay());
    if (!slot) continue;
    const time = local(slot.start);
    const start = date.getTime() - VN_OFFSET + (time.getUTCHours() * 60 + time.getUTCMinutes()) * 60000;
    return { startAt: input(start), endAt: input(start + slot.duration) };
  }
  return null;
}
