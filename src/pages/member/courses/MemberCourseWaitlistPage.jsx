import usePollingEffect from '../../../hooks/usePollingEffect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCourseIdempotencyKey } from '../../../services/courseServiceUtils';
import {
  acceptCourseWaitlistInvitation,
  leaveCourseWaitlist,
  listMyCourseWaitlists,
} from '../../../services/courseWaitlistService';
import {
  COURSE_WAITLIST_STATUS_LABELS,
  formatCourseDateTime,
  getCourseErrorMessage,
  getCourseStatusLabel,
} from '../../../utils/courseUi';
import './MemberCoursesPage.css';



export default function MemberCourseWaitlistPage() {
  const navigate = useNavigate();
  const [waitlists, setWaitlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const acceptKeys = useRef({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  const load = useCallback(async ({ background = false, commitValue = (setter, value) => setter(value), commitError = (setter, value) => setter(value), failed = () => {} } = {}) => {
    if (!background) commitValue(setLoading, true);
    commitError(setError, '');
    try {
      const data = await listMyCourseWaitlists();
      commitValue(setWaitlists, data);
    } catch (requestError) { failed(requestError);
      commitError(setError, getCourseErrorMessage(requestError, 'Không tải được thông tin khóa học của bạn.'));
    } finally {
      if (!background) commitValue(setLoading, false);
    }
  }, []);

  usePollingEffect(({ background, track, commitValue, commitError, failed }) => {
    track(load({ background, commitValue, commitError, failed }));
  }, [load], !busyId);

  async function handleLeave(item) {
    setBusyId(item.id);
    setError('');
    try {
      await leaveCourseWaitlist(item.courseRunId);
      await load();
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể rời danh sách chờ.'));
    } finally {
      setBusyId('');
    }
  }

  async function handleAccept(item) {
    setBusyId(item.id);
    setError('');
    try {
      const order = await acceptCourseWaitlistInvitation(
        item.id,
        acceptKeys.current[item.id] ||= createCourseIdempotencyKey('course-waitlist-accept'),
      );
      navigate(`/member/courses/${item.courseRunId}/register?orderId=${order.orderId}`);
    } catch (requestError) {
      setError(getCourseErrorMessage(requestError, 'Không thể nhận chỗ được mời.'));
    } finally {
      setBusyId('');
    }
  }

  const activeWaitlists = waitlists;

  return (
    <div className="member-course-page">
      <header className="member-course-heading">
        <div>
          <p className="member-course-eyebrow">Khóa học chuyên đề</p>
          <h1>Danh sách chờ khóa học</h1>
          <p>Theo dõi vị trí chờ và nhận chỗ khi có lời mời.</p>
        </div>
        <Link className="member-course-primary-link" to="/member/course-catalog">Khám phá khóa học</Link>
      </header>

      <button className="btn btn-outline-secondary btn-sm" type="button" disabled={loading || !!busyId} onClick={load}>Tải lại dữ liệu</button>
      {error && <div className="member-course-alert">{error}</div>}
      {loading ? (
        <div className="member-course-state">Đang tải dữ liệu khóa học…</div>
      ) : (
        <>
          <section className="member-course-section">
            <div className="member-course-section-title">
              <h2>Danh sách chờ</h2>
              <span>{activeWaitlists.length} yêu cầu</span>
            </div>
            {activeWaitlists.length ? (
              <div className="member-course-grid">
                {activeWaitlists.map((item) => {
                  const run = item;
                  return (
                    <article className="member-course-card" key={item.id}>
                      <div className="member-course-card-head">
                        <div>
                          <small>{run?.courseCode || 'Khóa học'} · {run?.runCode || 'Đợt học'}</small>
                          <h3>{run?.courseName || 'Thông tin khóa học'}</h3>
                        </div>
                        <span className={`member-course-status is-${item.status?.toLowerCase()}`}>
                          {getCourseStatusLabel(COURSE_WAITLIST_STATUS_LABELS, item.status)}
                        </span>
                      </div>
                      {item.status === 'WAITING' && <p>Vị trí hiện tại: <strong>#{item.position || '—'}</strong></p>}
                      {item.status === 'INVITED' && (
                        <p>Giữ chỗ đến {formatCourseDateTime(item.invitationExpiresAt)}.</p>
                      )}
                      <div className="member-course-actions">
                        {['INVITED', 'ACCEPTED'].includes(item.status) && (
                          <button type="button" disabled={!!busyId || (item.status === 'INVITED' && Date.parse(item.invitationExpiresAt) <= now)} onClick={() => handleAccept(item)}>
                            {item.status === 'ACCEPTED' ? 'Xem đơn thanh toán' : Date.parse(item.invitationExpiresAt) <= now ? 'Lời mời đã hết hạn' : 'Nhận chỗ và thanh toán'}
                          </button>
                        )}
                        {['WAITING', 'INVITED'].includes(item.status) && <button className="is-secondary" type="button" disabled={!!busyId} onClick={() => handleLeave(item)}>
                          Rời danh sách chờ
                        </button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="member-course-state"><p>Bạn không có yêu cầu chờ nào đang hoạt động.</p></div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
