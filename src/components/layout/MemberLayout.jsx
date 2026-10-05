// Khung giao diện cho khu vực Hội viên: sidebar tối bên trái, header phía
// trên, nội dung sáng ở giữa. Không dùng AppShell vì AppShell còn dùng chung
// cho Lễ tân / HLV / Quản lý.
//
// Layout tải danh sách Membership của Member 1 lần và chia sẻ qua
// MemberAreaContext (sidebar và Dashboard cùng dùng).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Button, Modal } from 'react-bootstrap';
import { useAuth } from '../../context/useAuth';
import { getMyMemberships } from '../../services/membershipService';
import BrandLogo from '../common/BrandLogo';
import { MemberAreaContext } from './MemberAreaContext';
import './MemberLayout.css';

// Icon SVG vẽ trực tiếp (giống trang Login) để không phải cài thư viện icon.
const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  profile: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6.5 6.5l11 11" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
      <path d="m2 6 4-4" />
      <path d="m18 22 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  receipt: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...iconProps}>
      {ICONS[name]}
    </svg>
  );
}

// Mục menu bên trái. `to: null` nghĩa là chưa có trang -> làm mờ.
const SIDEBAR_ITEMS = [
  { to: '/member/dashboard', label: 'Trang tổng quan', icon: 'dashboard' },
  { to: '/member/plan', label: 'Gói tập của tôi', icon: 'dumbbell' },
  { to: '/member/memberships', label: 'Lịch sử thanh toán', icon: 'receipt' },
  { to: '/member/profile', label: 'Hồ sơ cá nhân', icon: 'profile', end: true },
  { to: null, label: 'Lịch tập & Check-in', icon: 'calendar' },
];

// Mục menu trên header.
const TOP_ITEMS = [
  { to: '/member/dashboard', label: 'Trang chủ' },
  { to: '/offers', label: 'Gói tập' },
  { to: '/member/profile', label: 'Hồ sơ cá nhân', end: true },
  { to: null, label: 'Lịch tập' },
  { to: null, label: 'Thông báo' },
];

function SidebarItem({ item }) {
  if (!item.to) {
    return (
      <span
        className="scms-ml-navitem disabled"
        aria-disabled="true"
        title="Sắp ra mắt"
      >
        <Icon name={item.icon} />
        {item.label}
        <span className="scms-ml-soon">Sắp ra mắt</span>
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        `scms-ml-navitem${isActive ? ' active' : ''}`
      }
    >
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}

function TopItem({ item }) {
  if (!item.to) {
    return (
      <span
        className="scms-ml-toplink disabled"
        aria-disabled="true"
        title="Sắp ra mắt"
      >
        {item.label}
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        `scms-ml-toplink${isActive ? ' active' : ''}`
      }
    >
      {item.label}
    </NavLink>
  );
}

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

  return (
    <MemberAreaContext.Provider value={areaValue}>
      <div className="scms-ml">
        <aside className="scms-ml-sidebar">
          <div>
            <div className="scms-ml-sidebar-logo">
              <BrandLogo />
            </div>
            <div className="scms-ml-sidebar-label">Khu vực Hội viên</div>
            <nav className="scms-ml-nav">
              {SIDEBAR_ITEMS.map((item) => (
                <SidebarItem key={item.label} item={item} />
              ))}
              <button
                type="button"
                className="scms-ml-navitem scms-ml-navbtn"
                onClick={() => setConfirmOpen(true)}
              >
                <Icon name="logout" />
                Đăng xuất
              </button>
            </nav>
          </div>

          <div className="scms-ml-card">
            <div className="scms-ml-card-head">
              <span>Thẻ thành viên</span>
              <span
                className={`scms-ml-dot${activeMembership ? ' on' : ''}`}
                aria-hidden="true"
              ></span>
            </div>
            <div className="scms-ml-card-code">{user?.memberId || '—'}</div>
            <div
              className={`scms-ml-card-status${activeMembership ? ' on' : ''}`}
            >
              {statusText}
            </div>
          </div>
        </aside>

        <div className="scms-ml-body">
          <header className="scms-ml-header">
            <nav className="scms-ml-topnav">
              {TOP_ITEMS.map((item) => (
                <TopItem key={item.label} item={item} />
              ))}
            </nav>

            <div className="scms-ml-user">
              <span className="scms-ml-role">
                <span className="scms-ml-role-dot" aria-hidden="true"></span>
                Hội viên
              </span>
              <div className="scms-ml-user-text">
                <span className="scms-ml-user-name">
                  {user?.fullName || 'Hội viên'}
                </span>
                <span className="scms-ml-user-code">
                  {user?.memberId || '—'}
                </span>
              </div>
              <span className="scms-ml-avatar" aria-hidden="true">
                <Icon name="user" size={18} />
              </span>
              <button
                type="button"
                className="scms-ml-logout"
                onClick={() => setConfirmOpen(true)}
              >
                Đăng xuất
              </button>
            </div>
          </header>

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
