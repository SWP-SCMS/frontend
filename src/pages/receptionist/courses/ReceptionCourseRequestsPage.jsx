import { useState } from 'react';
import { Alert, Card } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { courseMemberSearchSchema } from '../../../schemas/courseSchemas';
import { searchReceptionMember } from '../../../services/receptionistService';
import { normalizePhone } from '../../../utils';
import { getCourseErrorMessage } from '../../../utils/courseUi';
import CourseMemberLookup from './CourseMemberLookup';
import ReceptionCourseActions from './ReceptionCourseActions';
import ReceptionCourseWithdrawals from './ReceptionCourseWithdrawals';

export default function ReceptionCourseRequestsPage() {
  const [member, setMember] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(courseMemberSearchSchema),
    defaultValues: { kind: 'memberId', query: '' },
  });
  async function lookup({ kind, query }) {
    setMember(null);
    setError('');
    try {
      setMember(await searchReceptionMember({ [kind]: kind === 'phone' ? normalizePhone(query) : query }));
    } catch (err) {
      setError(getCourseErrorMessage(err, 'Không tìm thấy hội viên.'));
    }
  }
  const refresh = () => setRevision(value => value + 1);
  return (
    <div className="scms-course-workspace">
      <h1>Khóa học của hội viên</h1>
      <p className="text-muted">Tra cứu hội viên để xem các đợt học, lịch học và yêu cầu rút khóa.</p>
      <Card className="border-0 shadow-sm"><Card.Body>
        <CourseMemberLookup register={register} errors={errors} onSubmit={handleSubmit(lookup)} disabled={isSubmitting} />
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {member && <div key={member.accountId}>
          <p className="mt-3">{member.fullName} · {member.memberId}</p>
          <ReceptionCourseWithdrawals member={member} refreshRevision={revision} onChanged={refresh} />
          <ReceptionCourseActions afterRegistration member={member} refreshRevision={revision} onChanged={refresh} />
        </div>}
      </Card.Body></Card>
    </div>
  );
}
