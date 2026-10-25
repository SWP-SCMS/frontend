import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Form, InputGroup, Spinner } from 'react-bootstrap';

import AuthenticatedProfileImage from '../../../components/common/AuthenticatedProfileImage';
import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listCoachAssignedMembers } from '../../../services/trainingService';
import { formatGymDate } from '../../../utils/gymTime';

export default function CoachAssignedMemberListPage() {
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listCoachAssignedMembers({ q: query, page, size: 20 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Hội viên được phân công</h1>
      <p className="text-muted">Danh sách hội viên hiện thuộc phạm vi huấn luyện của bạn.</p>
      <Form
        className="mb-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          setQuery(searchText.trim());
        }}
      >
        <InputGroup>
          <Form.Control
            value={searchText}
            maxLength={100}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Tìm theo mã hội viên, họ tên hoặc số điện thoại"
            aria-label="Tìm hội viên được phân công"
          />
          <Button type="submit" variant="danger">Tìm</Button>
          {query ? (
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => { setSearchText(''); setQuery(''); setPage(0); }}
            >
              Xóa lọc
            </Button>
          ) : null}
        </InputGroup>
      </Form>
      <ErrorAlert error={error} title="Không tải được danh sách hội viên" onClose={() => setError(null)} />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : !result?.content.length ? (
        <EmptyState
          title={query ? 'Không tìm thấy hội viên' : 'Chưa có hội viên được phân công'}
          message={query ? 'Thử mã hội viên, họ tên hoặc số điện thoại khác.' : 'Khi có phân công đang hiệu lực, hội viên sẽ xuất hiện tại đây.'}
        />
      ) : (
        <div className="d-grid gap-2">
          {result.content.map((member) => (
            <Card key={member.memberAccountId} className="border-0 shadow-sm">
              <Card.Body className="d-flex align-items-center gap-3">
                <AuthenticatedProfileImage
                  src={member.profileImageUrl}
                  alt={`Ảnh ${member.fullName}`}
                  width="64"
                  height="64"
                  className="rounded-circle border"
                  style={{ objectFit: 'cover' }}
                  fallback={<div className="rounded-circle border bg-light d-flex align-items-center justify-content-center" style={{ width: 64, height: 64 }}>HV</div>}
                />
                <div className="flex-grow-1">
                  <div className="fw-bold">{member.fullName}</div>
                  <div className="small text-muted">
                    {member.memberId} · {member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã kết thúc'}
                  </div>
                  <div className="small">Mục tiêu: {member.fitnessGoal || 'Chưa cập nhật'}</div>
                  <div className="small text-muted">Phân công từ {formatGymDate(member.assignedSince)}</div>
                </div>
                <Button as={Link} to={`/coach/members/${member.memberAccountId}`} variant="outline-danger" size="sm">
                  Xem hồ sơ
                </Button>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
      {(result?.totalPages || 0) > 1 ? <div className="d-flex justify-content-between mt-3">
        <Button variant="outline-danger" size="sm" disabled={loading || page <= 0} onClick={() => setPage((value) => value - 1)}>‹ Trang trước</Button>
        <span className="small text-muted">Trang {(result?.page || 0) + 1}/{Math.max(1, result?.totalPages || 0)}</span>
        <Button variant="outline-danger" size="sm" disabled={loading || !result || page + 1 >= result.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau ›</Button>
      </div> : null}
    </div>
  );
}
