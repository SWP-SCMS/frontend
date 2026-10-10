// Khung giao diện cho khu vực Hội viên: sidebar tối bên trái, header phía
// trên, nội dung sáng ở giữa. Không dùng AppShell vì AppShell còn dùng chung
// cho Lễ tân / HLV / Quản lý.
//
// Layout tải danh sách Membership của Member 1 lần và chia sẻ qua
// MemberAreaContext (sidebar và Dashboard cùng dùng).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/useAuth';
import { getMyMemberships } from '../../services/membershipService';
import { MemberAreaContext } from './MemberAreaContext';
import MemberSidebar from './MemberSidebar';
import MemberHeader from './MemberHeader';
import { MEMBER_SIDEBAR_ITEMS } from './navConfig';
import './MemberLayout.css';

export default function MemberLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hộp thoại xác nhận trước khi đăng xuất.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMemberships(await getMyMemberships());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  // BR-MEM-04/05: Membership hết hạn chuyển sang EXPIRED và không dùng lại.
  // Chỉ Membership ACTIVE mới được coi là "đang có gói".
  const activeMembership = useMemo(
    () => memberships.find((m) => m.status === 'ACTIVE') || null,
    [memberships],
  );

  const areaValue = useMemo(
    () => ({
      memberships,
      activeMembership,
      hasActiveMembership: activeMembership != null,
      loading,
      error,
      reload: loadMemberships,
    }),
    [memberships, activeMembership, loading, error, loadMemberships],
  );

  // Chỉ đăng xuất sau khi người dùng bấm "Đăng xuất" trong hộp thoại xác nhận.
  async function handleConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  // Dòng trạng thái ở thẻ thành viên (góc dưới sidebar).
  let statusText = 'Đang tải...';
  if (!loading && error) statusText = 'Không tải được gói tập';
  else if (!loading && activeMembership) {
    const plan = activeMembership.plan_code_snapshot || activeMembership.planCode;
    statusText = plan ? `Gói ${plan} đang hoạt động` : 'Đang có gói tập';
  } else if (!loading) statusText = 'Chưa kích hoạt gói tập';

  const requestLogout = () => setConfirmOpen(true);

  // Số thông báo chưa đọc (UNREAD) hiện trên chuông.
  // TODO: BE chưa có API đọc thông báo cho Hội viên (BR-NOT-03/04). Khi có,
  // thay số 0 này bằng số thông báo UNREAD lấy từ API.
  // Muốn xem thử chấm đỏ: tạm đổi 0 thành 1.
  const unreadCount = 0;

  return (
    <MemberAreaContext.Provider value={areaValue}>
      <div className="scms-ml">
        <MemberSidebar
          user={user}
          activeMembership={activeMembership}
          statusText={statusText}
          items={MEMBER_SIDEBAR_ITEMS}
          onRequestLogout={requestLogout}
        />

        <div className="scms-ml-body">
          <MemberHeader
            user={user}
            unreadCount={unreadCount}
            onRequestLogout={requestLogout}
          />

          <main className="scms-ml-main">{children}</main>
        </div>

        <Modal
          show={confirmOpen}
          onHide={() => (loggingOut ? null : setConfirmOpen(false))}
          centered
        >
          <Modal.Header closeButton={!loggingOut}>
            <Modal.Title className="h5">Xác nhận đăng xuất</Modal.Title>
          </Modal.Header>
          <Modal.Body>Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?</Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={loggingOut}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </MemberAreaContext.Provider>
  );
}
