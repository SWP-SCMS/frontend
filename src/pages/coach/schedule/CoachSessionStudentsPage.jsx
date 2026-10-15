// /coach/schedule/:sessionId/students — danh sách học viên của buổi dạy.
// Trang CHỈ XEM: điểm danh chỉ hiển thị, muốn sửa thì sang trang Điểm danh.
// Cột "Đánh giá" chờ BE có API Feedback (BR-FDB-*).

import { Link, useParams } from 'react-router-dom';
import { Button, Spinner, Table } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import SessionSummary from './SessionSummary';
import { useCoachSession } from './useCoachSession';
import './CoachSchedulePage.css';

// Chưa có bản ghi (chưa tới giờ điểm danh) -> "Chưa" xám; PRESENT -> "Có mặt"
// xanh lá; ABSENT -> "Vắng" đỏ.
function AttendanceBadge({ record }) {
  if (!record) return <span className="text-secondary">Chưa</span>;
  return record.status === 'PRESENT' ? (
    <span className="text-success fw-semibold">Có mặt</span>
  ) : (
    <span className="text-danger fw-semibold">Vắng</span>
  );
}

export default function CoachSessionStudentsPage() {
  const { sessionId } = useParams();
  const { session, attendanceByMember, loading, error, setError } =
    useCoachSession(sessionId);

  return (
    <div className="scms-coach-page">
      <h1 className="h3 fw-bold mb-3">Danh sách học viên</h1>

      <ErrorAlert
        error={error}
        title="Không tải được danh sách học viên"
        onClose={() => setError(null)}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" size="sm" /> Đang tải...
        </div>
      ) : session ? (
        <>
          <SessionSummary session={session} />

          {session.members?.length ? (
            <div className="scms-coach-card mb-3">
              <Table responsive className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Mã HV</th>
                    <th>Họ tên</th>
                    <th>SĐT</th>
                    <th>Điểm danh</th>
                    <th>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {session.members.map((m) => (
                    <tr key={m.memberId}>
                      <td>{m.memberCode}</td>
                      <td>{m.fullName}</td>
                      <td>{m.phone || '—'}</td>
                      <td>
                        <AttendanceBadge
                          record={attendanceByMember.get(m.memberId)}
                        />
                      </td>
                      <td className="text-muted small">Sắp ra mắt</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="scms-coach-empty mb-3">
              Chưa có học viên đăng ký.
            </div>
          )}

          <Button
            as={Link}
            to="/coach/schedule"
            variant="outline-secondary"
          >
            Quay lại lịch phụ trách
          </Button>
        </>
      ) : null}
    </div>
  );
}
