import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import AuthenticatedProfileImage from '../../../components/common/AuthenticatedProfileImage';
import ErrorAlert from '../../../components/common/ErrorAlert';
import WorkflowBreadcrumb from '../../../components/common/WorkflowBreadcrumb';
import { getCoachAssignedMember } from '../../../services/trainingService';
import { formatDate } from '../../../utils';
import { formatGymDate } from '../../../utils/gymTime';

export default function CoachMemberProfilePage() {
  const { memberAccountId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCoachAssignedMember(memberAccountId)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [memberAccountId]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (error || !profile) return <><ErrorAlert error={error} title="Không tải được hồ sơ hội viên" /><Link to="/coach/members">← Quay lại</Link></>;

  return (
    <div>
      <WorkflowBreadcrumb
        items={[{ to: '/coach/members', label: 'Hội viên được phân công' }]}
        current={profile.memberId || profile.fullName || 'Chi tiết'}
      />
      <div className="d-flex align-items-center gap-3 my-3">
        <AuthenticatedProfileImage src={profile.profileImageUrl} alt={`Ảnh ${profile.fullName}`} width="96" height="96" className="rounded-circle border" style={{ objectFit: 'cover' }} fallback={<div className="rounded-circle border bg-light d-flex align-items-center justify-content-center" style={{ width: 96, height: 96 }}>HV</div>} />
        <div><h1 className="h3 fw-bold mb-1">{profile.fullName}</h1><div className="text-muted">{profile.memberId} · {profile.status}</div></div>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Button as={Link} to={`/coach/members/${memberAccountId}/training-plans`} variant="outline-danger">Giáo án</Button>
        <Button as={Link} to={`/coach/members/${memberAccountId}/training-results`} variant="outline-danger">Kết quả tập luyện</Button>
        <Button as={Link} to={`/coach/members/${memberAccountId}/feedback`} variant="outline-danger">Nhận xét</Button>
      </div>
      <Row className="g-3">
        <Col md={6}><Card className="border-0 shadow-sm h-100"><Card.Body><h2 className="h6">Thông tin liên hệ</h2><dl className="row mb-0 small"><dt className="col-4">Điện thoại</dt><dd className="col-8">{profile.phone || '—'}</dd><dt className="col-4">Email</dt><dd className="col-8">{profile.email || '—'}</dd><dt className="col-4">Ngày sinh</dt><dd className="col-8">{formatDate(profile.birthDate)}</dd></dl></Card.Body></Card></Col>
        <Col md={6}><Card className="border-0 shadow-sm h-100"><Card.Body><h2 className="h6">Huấn luyện</h2><p><strong>Mục tiêu:</strong> {profile.fitnessGoal || 'Chưa cập nhật'}</p><p className="mb-0"><strong>Phân công từ:</strong> {formatGymDate(profile.assignedSince)}</p></Card.Body></Card></Col>
        <Col xs={12}><Card className="border-0 shadow-sm"><Card.Body><h2 className="h6">Liên hệ khẩn cấp</h2><p className="mb-0">{profile.emergencyContactName || '—'}{profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ''}</p></Card.Body></Card></Col>
      </Row>
    </div>
  );
}
