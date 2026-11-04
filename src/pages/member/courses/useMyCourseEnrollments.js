import { useCallback, useState } from 'react';
import usePollingEffect from '../../../hooks/usePollingEffect';
import { listMyCourseEnrollments } from '../../../services/courseEnrollmentService';
import { getCourseErrorMessage } from '../../../utils/courseUi';

export default function useMyCourseEnrollments() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) setLoading(true);
    commitError(setError, '');
    try { commitValue(setEnrollments, await listMyCourseEnrollments()); }
    catch (err) { failed(err); commitError(setError, getCourseErrorMessage(err, 'Không tải được khóa học. Vui lòng thử lại.')); }
    finally { if (!background) commitValue(setLoading, false); }
  }, []);
  usePollingEffect(context => { context.track(reload(context)); }, [reload]);
  return { enrollments, loading, error, reload };
}
