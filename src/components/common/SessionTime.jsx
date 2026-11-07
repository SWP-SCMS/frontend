const sessionClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const sessionDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'numeric', year: 'numeric',
});
export default function SessionTime({ startAt, endAt }) {
  const start = new Date(startAt), end = new Date(endAt);
  if (!startAt || !endAt || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '—';
  const startDate = sessionDate.format(start), endDate = sessionDate.format(end);
  return <>
    <span className="text-nowrap">{sessionClock.format(start)} – {sessionClock.format(end)}</span>
    <small className="d-block text-muted mt-1">{startDate === endDate ? startDate : `${startDate} – ${endDate}`}</small>
  </>;
}
