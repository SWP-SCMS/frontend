export const SESSION_SLOTS = Array.from({ length: 8 }, (_, index) => {
  const hour = 7 + index * 2;
  return { id: String(index + 1), label: `Slot ${index + 1}`, start: `${String(hour).padStart(2, '0')}:00`, end: `${String(hour + 1).padStart(2, '0')}:00` };
});

const gymClock = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';
};
export const sessionSlotKey = session => `${gymClock(session.startTime)}-${gymClock(session.endTime)}`;
export function formatSessionSlot(start, end) {
  const startTime = gymClock(start), endTime = gymClock(end);
  const slot = SESSION_SLOTS.find(item => item.start === startTime && item.end === endTime);
  return `${slot ? slot.label : 'Ngoài slot'} · ${startTime}–${endTime}`;
}
export function calendarSlotRows(sessions) {
  const rows = new Map(SESSION_SLOTS.map(slot => [`${slot.start}-${slot.end}`, { ...slot, key: `${slot.start}-${slot.end}` }]));
  for (const session of sessions) {
    const key = sessionSlotKey(session);
    if (!rows.has(key)) rows.set(key, { key, label: 'Ngoài slot', start: gymClock(session.startTime), end: gymClock(session.endTime) });
  }
  return [...rows.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}
