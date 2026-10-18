import { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { formatGymDate, formatGymTime } from '../../utils/gymTime';

export default function AffectedSessionsAlert({
  message,
  sessions = [],
  classId = null,
}) {
  const [showAll, setShowAll] = useState(false);
  const sessionKey = useMemo(
    () => sessions.map((session) => session.sessionId).join('|'),
    [sessions],
  );

  useEffect(() => {
    setShowAll(false);
  }, [sessionKey]);

  if (!message) return null;
  const visibleSessions = showAll ? sessions : sessions.slice(0, 3);
  const hiddenCount = Math.max(0, sessions.length - visibleSessions.length);
  const filteredListUrl = classId
    ? `/manager/class-sessions?view=list&classId=${encodeURIComponent(classId)}&status=SCHEDULED`
    : sessions.length > 0
      ? '/manager/class-sessions?view=list&status=SCHEDULED'
      : null;

  return (
    <Alert variant="warning">
      <div>{message}</div>
      {filteredListUrl && sessions.length > 0 ? (
        <Button
          as={Link}
          to={filteredListUrl}
          variant="outline-danger"
          size="sm"
          className="mt-2"
        >
          Mở danh sách buổi tập để xử lý
        </Button>
      ) : null}
      {sessions.length > 0 ? (
        <div className="mt-2">
          <div className="fw-semibold">Các buổi tập bị ảnh hưởng:</div>
          <ul className="mb-0 mt-1">
            {visibleSessions.map((session) => (
              <li key={session.sessionId} className="mb-2">
                <div>
                  <Link to={`/manager/class-sessions/${session.sessionId}`}>
                    {session.className || 'Xem chi tiết buổi tập'}
                  </Link>
                  {!session.className ? (
                    <>
                      {' '}
                      <code>{session.sessionId}</code>
                    </>
                  ) : null}
                </div>
                {session.startTime || session.endTime ? (
                  <div className="small text-muted">
                    Bắt đầu:{' '}
                    {session.startTime
                      ? `${formatGymDate(session.startTime)} · ${formatGymTime(session.startTime)}`
                      : '—'}
                    {' · '}Kết thúc:{' '}
                    {session.endTime
                      ? `${formatGymDate(session.endTime)} · ${formatGymTime(session.endTime)}`
                      : '—'}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {sessions.length > 3 ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 mt-1"
              onClick={() => setShowAll((current) => !current)}
              aria-expanded={showAll}
            >
              {showAll
                ? 'Thu gọn danh sách session ảnh hưởng'
                : `Xem tất cả session ảnh hưởng (${hiddenCount} session khác)`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Alert>
  );
}
