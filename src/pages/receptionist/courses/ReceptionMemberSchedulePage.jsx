import { useState } from 'react';
import { Alert, Card, Table, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseMemberSearchSchema } from '../../../schemas/courseSchemas';
import { searchReceptionMember } from '../../../services/receptionistService';
import { normalizePhone } from '../../../utils';
import { getCourseErrorMessage } from '../../../utils/courseUi';
import CourseMemberLookup from './CourseMemberLookup';
import api from '../../../services/api';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
const types = { COURSE: 'Khóa học', GROUP: 'Lớp nhóm', YOGA: 'Yoga', PT_1_1: 'PT 1-1' };

export default function ReceptionMemberSchedulePage() {
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState([]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(courseMemberSearchSchema),
    defaultValues: { kind: 'memberId', query: '' },
  });
  async function lookup({ kind, query }) {
    setMember(null);
    setError('');
    try {
      const profile = await searchReceptionMember({ [kind]: kind === 'phone' ? normalizePhone(query) : query });
      const { data } = await api.get(`/reception/members/${profile.accountId}/upcoming-sessions`);
      setSessions(data);
      setMember(profile);
    } catch (err) {
      setError(getCourseErrorMessage(err, 'Không thể tra cứu lịch của hội viên.'));
    }
  }
  return (
    <div className="scms-course-workspace">
      <h1>Lịch học của hội viên</h1>
      <p className="text-muted">Tra cứu theo mã hội viên hoặc số điện thoại để xem các buổi sắp tới.</p>
      <Card className="border-0 shadow-sm"><Card.Body>
        <CourseMemberLookup register={register} errors={errors} onSubmit={handleSubmit(lookup)} disabled={isSubmitting} />
        {isSubmitting && <Spinner size="sm" role="status" aria-label="Đang tra cứu" />}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {member && <div key={member.accountId}>
          <p className="mt-3">{member.fullName} · {member.memberId}</p>
          {sessions.length ? <Table responsive className="align-middle">
            <thead><tr><th>Ngày</th><th>Giờ học</th><th>Loại buổi</th><th>Lớp / khóa học</th><th>Phòng</th><th>Huấn luyện viên</th></tr></thead>
            <tbody>{sessions.map(session => (
              <tr key={session.classType + session.sessionId}>
                <td>{formatGymDate(session.startAt)}</td>
                <td className="text-nowrap">{formatGymTime(session.startAt)} – {formatGymTime(session.endAt)}</td>
                <td>{types[session.classType] || session.classType}</td>
                <td>{session.className}{session.runCode && <small className="d-block text-muted">{session.runCode} · Buổi {session.unitNumber}</small>}</td>
                <td>{session.roomName || '—'}</td><td>{session.coachName || '—'}</td>
              </tr>
            ))}</tbody>
          </Table> : <p>Hội viên chưa có buổi học sắp tới.</p>}
        </div>}
      </Card.Body></Card>
    </div>
  );
}
