// Trang tổng quan của Huấn luyện viên.
//
// API: GET /coach/class-sessions và GET /coach/class-sessions/{id}
//   - Buổi hôm nay        : from = 00:00 hôm nay, to = hết hôm nay
//   - Buổi sắp tới        : status = SCHEDULED, from = bây giờ, 5 buổi đầu
//   - Lớp đang mở         : các lớp (classId) còn buổi SCHEDULED hoặc
//                           IN_PROGRESS của Coach
//   - Học viên đã đăng ký : hội viên (memberId) đã đặt các buổi đó, lấy từ API
//                           chi tiết (BE chưa có API thống kê nên gom ở FE,
//                           tối đa 100 buổi mỗi loại)
//
// Ba ô thống kê bấm được: mở hộp danh sách tương ứng.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Modal, Spinner, Table } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { useAuth } from '../../../context/useAuth';
import {
  getCoachSession,
  listCoachSessions,
} from '../../../services/coachScheduleService';
import {
  formatGymDate,
  formatGymTime,
  getGymZoneTodayIsoDate,
  gymEndOfDayIsoInstant,
  gymLocalDateToIsoInstant,
} from '../../../utils/gymTime';
import CoachSessionModal from '../schedule/CoachSessionModal';
import { SESSION_STATUS_LABELS } from '../schedule/sessionStatus';
import '../schedule/CoachSchedulePage.css';

function StatusBadge({ status }) {
  const info = SESSION_STATUS_LABELS[status];
  return (
    <Badge bg={info?.variant ?? 'secondary'}>{info?.text ?? status}</Badge>
  );
}

function SessionTable({ sessions, showDate }) {
  return (
    <Table responsive className="align-middle mb-0">
      <thead>
        <tr>
          {showDate ? <th>Ngày</th> : null}
          <th>Giờ</th>
          <th>Sĩ số tối đa</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id}>
            {showDate ? <td>{formatGymDate(s.startTime)}</td> : null}
            <td>
              {formatGymTime(s.startTime)} – {formatGymTime(s.endTime)}
            </td>
            <td>{s.capacity}</td>
            <td>
              <StatusBadge status={s.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// Tải chi tiết nhiều buổi, tối đa DETAIL_CONCURRENCY request cùng lúc.
// Buổi nào lỗi thì bỏ qua (không có trong Map) chứ không làm hỏng cả trang.
const DETAIL_CONCURRENCY = 5;

async function fetchDetails(ids, isCancelled) {
  const result = new Map();
  let next = 0;
  async function worker() {
    while (next < ids.length && !isCancelled()) {
      const id = ids[next];
      next += 1;
      try {
        result.set(id, await getCoachSession(id));
      } catch {
        // bỏ qua buổi lỗi
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(DETAIL_CONCURRENCY, ids.length) }, worker),
  );
  return result;
}

// Ô thống kê bấm được.
function StatCard({ value, label, onClick }) {
  return (
    <button
      type="button"
      className="scms-coach-stat scms-coach-stat-btn"
      onClick={onClick}
    >
      <div className="scms-coach-stat-num">{value}</div>
      <div className="scms-coach-stat-label">{label}</div>
    </button>
  );
}

export default function CoachDashboardPage() {
  const { user } = useAuth();
  const [today, setToday] = useState([]); // buổi hôm nay, đã có tên lớp / phòng
  const [upcoming, setUpcoming] = useState([]);
  const [openSessions, setOpenSessions] = useState([]); // buổi còn hiệu lực (chưa có tên lớp)
  const [openDetails, setOpenDetails] = useState([]); // chi tiết các buổi còn hiệu lực
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hộp đang mở: 'today' | 'classes' | 'members' | null.
  const [panel, setPanel] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Bước 1: các danh sách nhẹ. Xong là hiện trang ngay.
        const todayYmd = getGymZoneTodayIsoDate();
        const [todayRes, upcomingRes, scheduled, inProgress] =
          await Promise.all([
            listCoachSessions({
              from: gymLocalDateToIsoInstant(todayYmd),
              to: gymEndOfDayIsoInstant(todayYmd),
              size: 50,
            }),
            listCoachSessions({
              from: new Date().toISOString(),
              status: 'SCHEDULED',
              size: 5,
            }),
            listCoachSessions({ status: 'SCHEDULED', size: 100 }),
            listCoachSessions({ status: 'IN_PROGRESS', size: 100 }),
          ]);
        if (cancelled) return;

        const todayList = todayRes.content ?? [];
        const openSessions = [
          ...(scheduled.content ?? []),
          ...(inProgress.content ?? []),
        ];
        setToday(todayList);
        setUpcoming(upcomingRes.content ?? []);
        setOpenSessions(openSessions);
        setLoading(false);

        // Bước 2 (chạy nền): API chi tiết để lấy tên lớp, phòng, học viên.
        // Gộp buổi hôm nay + buổi còn hiệu lực, bỏ trùng, và chỉ gọi vài
        // request cùng lúc để không làm nghẽn trình duyệt / BE.
        const ids = [...new Set([...todayList, ...openSessions].map((x) => x.id))];
        const detailMap = await fetchDetails(ids, () => cancelled);
        if (cancelled) return;

        setToday(
          todayList.map((x) => ({
            ...x,
            className: detailMap.get(x.id)?.className,
            roomName: detailMap.get(x.id)?.roomName,
          })),
        );
        setOpenDetails(
          openSessions.map((x) => detailMap.get(x.id)).filter(Boolean),
        );
        setDetailsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setLoading(false);
          setDetailsLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lớp đang mở: gom các buổi còn hiệu lực theo classId.
  const openClasses = useMemo(() => {
    const map = new Map();
    openDetails.forEach((d) => {
      if (!map.has(d.classId)) {
        map.set(d.classId, {
          classId: d.classId,
          className: d.className,
          disciplineName: d.disciplineName,
          sessionCount: 0,
          memberIds: new Set(),
        });
      }
      const item = map.get(d.classId);
      item.sessionCount += 1;
      d.members?.forEach((m) => item.memberIds.add(m.memberId));
    });
    return [...map.values()];
  }, [openDetails]);

  // Học viên đã đăng ký: mỗi người một dòng, kèm các lớp họ tham gia.
  const registeredMembers = useMemo(() => {
    const map = new Map();
    openDetails.forEach((d) => {
      d.members?.forEach((m) => {
        if (!map.has(m.memberId)) {
          map.set(m.memberId, { ...m, classNames: new Set() });
        }
        map.get(m.memberId).classNames.add(d.className);
      });
    });
    return [...map.values()];
  }, [openDetails]);

  // Số lớp lấy ngay từ danh sách (classId), không cần đợi API chi tiết.
  const openClassCount = useMemo(
    () => new Set(openSessions.map((x) => x.classId)).size,
    [openSessions],
  );

  const todayActive = today.filter((s) => s.status !== 'CANCELLED');

  return (
    <div className="scms-coach-page">
      <h1 className="h3 fw-bold mb-1">
        Xin chào, {user?.fullName || 'Huấn luyện viên'}!
      </h1>
      <p className="text-muted mb-4">Tổng quan lịch dạy của bạn.</p>

      <ErrorAlert
        error={error}
        title="Không tải được dữ liệu"
        onClose={() => setError(null)}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" size="sm" /> Đang tải...
        </div>
      ) : (
        <>
          <div className="scms-coach-stats">
            <StatCard
              value={todayActive.length}
              label="Buổi dạy hôm nay"
              onClick={() => setPanel('today')}
            />
            <StatCard
              value={openClassCount}
              label="Lớp đang mở"
              onClick={() => setPanel('classes')}
            />
            <StatCard
              value={detailsLoading ? '…' : registeredMembers.length}
              label="Học viên đã đăng ký lớp"
              onClick={() => setPanel('members')}
            />
          </div>

          <h2 className="h5">Hôm nay</h2>
          {today.length === 0 ? (
            <div className="scms-coach-empty mb-4">Hôm nay bạn không có buổi dạy.</div>
          ) : (
            <div className="scms-coach-card mb-4">
              <SessionTable sessions={today} />
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5">Sắp tới</h2>
            <Link to="/coach/schedule">Xem tất cả lịch</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="scms-coach-empty">Chưa có buổi dạy sắp tới.</div>
          ) : (
            <div className="scms-coach-card">
              <SessionTable sessions={upcoming} showDate />
            </div>
          )}
        </>
      )}

      {/* Hộp danh sách khi bấm vào ô thống kê */}
      <Modal
        show={panel != null}
        onHide={() => setPanel(null)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="h5">
            {panel === 'today' && 'Lịch dạy hôm nay'}
            {panel === 'classes' && 'Các lớp đang mở'}
            {panel === 'members' && 'Học viên đã đăng ký lớp'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {panel === 'today' &&
            (today.length === 0 ? (
              <p className="text-muted mb-0">Hôm nay bạn không có buổi dạy.</p>
            ) : (
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Giờ</th>
                    <th>Lớp</th>
                    <th>Phòng</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {today.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {formatGymTime(s.startTime)} –{' '}
                        {formatGymTime(s.endTime)}
                      </td>
                      <td>{s.className || '—'}</td>
                      <td>{s.roomName || '—'}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => {
                            setPanel(null);
                            setSelectedSessionId(s.id);
                          }}
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ))}

          {panel !== 'today' && detailsLoading && (
            <div className="text-center py-3">
              <Spinner animation="border" size="sm" /> Đang tải...
            </div>
          )}

          {panel === 'classes' &&
            !detailsLoading &&
            (openClasses.length === 0 ? (
              <p className="text-muted mb-0">Bạn chưa có lớp đang mở.</p>
            ) : (
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Bộ môn</th>
                    <th>Số buổi sắp tới</th>
                    <th>Học viên</th>
                  </tr>
                </thead>
                <tbody>
                  {openClasses.map((c) => (
                    <tr key={c.classId}>
                      <td>{c.className || '—'}</td>
                      <td>{c.disciplineName || '—'}</td>
                      <td>{c.sessionCount}</td>
                      <td>{c.memberIds.size}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ))}

          {panel === 'members' &&
            !detailsLoading &&
            (registeredMembers.length === 0 ? (
              <p className="text-muted mb-0">Chưa có học viên đăng ký.</p>
            ) : (
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Mã HV</th>
                    <th>Họ tên</th>
                    <th>SĐT</th>
                    <th>Lớp tham gia</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredMembers.map((m) => (
                    <tr key={m.memberId}>
                      <td>{m.memberCode}</td>
                      <td>{m.fullName}</td>
                      <td>{m.phone || '—'}</td>
                      <td>{[...m.classNames].join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setPanel(null)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {selectedSessionId ? (
        <CoachSessionModal
          sessionId={selectedSessionId}
          onHide={() => setSelectedSessionId(null)}
        />
      ) : null}
    </div>
  );
}
