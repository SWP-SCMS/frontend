// AppShell — chrome for authenticated routes (header, sidebar, footer).
// Public pages (Home, Login, Register, Offers) intentionally render
// without this shell so the marketing site stays distinct from the
// authenticated product.

import { useState } from 'react';
import { Container, Navbar, Nav, Offcanvas, Button, Dropdown } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants';

const NAV_ITEMS = {
  [ROLES.MEMBER]: [
    { to: '/member/dashboard', label: 'Tổng quan' },
    { to: '/member/profile', label: 'Hồ sơ' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/reception/dashboard', label: 'Tổng quan' },
    { to: '/reception/members', label: 'Tra cứu hội viên' },
    { to: '/reception/members/new', label: 'Đăng ký hội viên' },
    { to: '/reception/orders/new', label: 'Tạo đơn gói tập' },
    { to: '/reception/membership-offers', label: 'Gói tập' },
    { to: '/reception/payments/reconcile', label: 'Đối soát' },
    { to: '/reception/payments/cash', label: 'Thu tiền mặt' },
  ],
  [ROLES.COACH]: [{ to: '/coach', label: 'HLV' }],
  [ROLES.MANAGER]: [
    { to: '/manager/dashboard', label: 'Tổng quan' },
    { to: '/manager/staff-accounts', label: 'Nhân viên & QL' },
    { to: '/manager/membership-offers', label: 'Gói tập' },
    { to: '/manager/members', label: 'Hội viên' },
    { to: '/manager/reports', label: 'Báo cáo' },
    { to: '/manager/payments/reconcile', label: 'Đối soát' },
  ],
};

// Role-specific entry on the user dropdown menu. Manager/Staff get a
// "Dashboard" link; Member keeps the profile + change-password entries.
const USER_MENU = {
  [ROLES.MANAGER]: [
    { to: '/manager/dashboard', label: 'Trang tổng quan' },
  ],
  [ROLES.RECEPTIONIST]: [
    { to: '/reception/dashboard', label: 'Trang tổng quan' },
  ],
  [ROLES.COACH]: [
    { to: '/coach', label: 'Trang tổng quan' },
  ],
};

export default function AppShell({ children }) {
  const { user, role, isAuthenticated, logout } = useAuth();
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();

  const items = role ? NAV_ITEMS[role] || [] : [];
  const userMenuItems = role ? USER_MENU[role] || [] : [];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      <Navbar bg="dark" variant="dark" expand="md" className="border-bottom border-danger border-3">
        <Container fluid>
          <Button
            variant="outline-light"
            className="d-md-none me-2"
            onClick={() => setShowSidebar(true)}
            aria-label="Mở menu"
          >
            ☰
          </Button>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            <span className="scms-brand">SCMS</span>
            <span className="ms-2 text-white-50">Sports Center</span>
          </Navbar.Brand>

          <Nav className="ms-auto align-items-center">
            {isAuthenticated ? (
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="outline-light"
                  size="sm"
                  id="user-menu"
                >
                  {user?.fullName || 'Tài khoản'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {role === ROLES.MEMBER ? (
                    <>
                      <Dropdown.Item as={Link} to="/member/profile">
                        Hồ sơ
                      </Dropdown.Item>
                      <Dropdown.Item as={Link} to="/member/profile/password">
                        Đổi mật khẩu
                      </Dropdown.Item>
                      <Dropdown.Divider />
                    </>
                  ) : null}
                  {userMenuItems.length > 0 ? (
                    <>
                      {userMenuItems.map((item) => (
                        <Dropdown.Item key={item.to} as={Link} to={item.to}>
                          {item.label}
                        </Dropdown.Item>
                      ))}
                      <Dropdown.Divider />
                    </>
                  ) : null}
                  <Dropdown.Item onClick={handleLogout}>Đăng xuất</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Nav.Link as={Link} to="/login">
                Đăng nhập
              </Nav.Link>
            )}
          </Nav>
        </Container>
      </Navbar>

      <div className="d-flex flex-grow-1">
        {/* Sidebar (md+) */}
        <aside className="bg-white border-end d-none d-md-block scms-sidebar">
          <SidebarContent items={items} />
        </aside>

        {/* Sidebar (mobile offcanvas) */}
        <Offcanvas
          show={showSidebar}
          onHide={() => setShowSidebar(false)}
          responsive="md"
          placement="start"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Menu</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <SidebarContent
              items={items}
              onNavigate={() => setShowSidebar(false)}
            />
          </Offcanvas.Body>
        </Offcanvas>

        <main className="flex-grow-1">
          <Container fluid="lg" className="py-4">
            {children}
          </Container>
        </main>
      </div>

      <footer className="bg-dark text-white-50 py-3 mt-auto">
        <Container fluid="lg" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <small>© {new Date().getFullYear()} SWP GYM — SCMS</small>
          <small>Phiên bản dành cho desktop</small>
        </Container>
      </footer>
    </div>
  );
}

function SidebarContent({ items, onNavigate }) {
  return (
    <nav className="p-3">
      <ul className="list-unstyled m-0">
        {items.length === 0 ? (
          <li className="text-muted small">Không có mục nào.</li>
        ) : (
          items.map((item) => (
            <li key={item.to} className="mb-1">
              <NavLink
                to={item.to}
                end
                onClick={onNavigate}
                className={({ isActive }) =>
                  `d-block px-3 py-2 rounded text-decoration-none ${
                    isActive
                      ? 'bg-danger-subtle text-danger fw-semibold'
                      : 'text-body'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))
        )}
      </ul>
    </nav>
  );
}
