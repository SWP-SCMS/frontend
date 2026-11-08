export const sessionKey = session => `${session.type}/${session.id}`;
export function sessionsOverlap(sessions) {
  return sessions.some((a, index) => sessions.slice(index + 1).some(b =>
    Date.parse(a.startTime) < Date.parse(b.endTime) && Date.parse(b.startTime) < Date.parse(a.endTime)));
}
