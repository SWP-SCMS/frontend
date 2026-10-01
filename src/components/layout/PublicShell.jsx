// PublicShell — chrome for the pre-login marketing/auth pages. Slightly
// different look/feel from AppShell so guests don't feel like they're
// already inside the product.
//
// Can be used either as a layout (`<PublicShell><Page /></PublicShell>`)
// or as a layout route via `<Outlet />`. Both renderings share the same
// header/footer markup.
//
// The header subscribes to AuthContext so it reflects the current auth
// state: guests see "Đăng nhập / Đăng ký", signed-in members see their
// name + a logout button. While auth is still bootstrapping we render a
// neutral placeholder to avoid a flash of "Đăng ký" right after login.

import { Container, Navbar, Nav, Dropdown } from 'react-bootstrap';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export default function PublicShell({ children }) {
  const { isAuthenticated, isReady, user, logout } = useAuth();

  // While we're still figuring out whether the user has a valid session,
  // reserve roughly the same vertical space so the header doesn't jump
  // once we resolve to "authenticated" or "unauthenticated".
  const showAuthControls = isReady;

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar bg="white" expand="md" className="border-bottom shadow-sm">
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            <span className="scms-brand">SCMS</span>
            <span className="ms-2 text-muted">Sports Center</span>
          </Navbar.Brand>
          <Nav className="ms-auto align-items-center gap-2">
            <Nav.Link as={NavLink} to="/offers" end>
              Gói tập
            </Nav.Link>

            {!showAuthControls && (
              // Reserve space while auth is bootstrapping.
              <span className="scms-header-placeholder" aria-hidden="true">
                .
              </span>
            )}

            {showAuthControls && !isAuthenticated && (
              <>
                <Nav.Link as={NavLink} to="/login">
                  Đăng nhập
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/register"
                  className="btn btn-danger text-white px-3"
                >
                  Đăng ký
                </Nav.Link>
              </>
            )}

            {showAuthControls && isAuthenticated && (
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="outline-dark"
                  size="sm"
                  id="public-shell-account-menu"
                  className="d-flex align-items-center gap-2"
                >
                  <span className="scms-avatar" aria-hidden="true">
                    {(user?.fullName || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="d-none d-md-inline">
                    {user?.fullName || 'Tài khoản'}
                  </span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Header>
                    Xin chào, {user?.fullName || 'bạn'}
                  </Dropdown.Header>
                  <Dropdown.Item as={Link} to="/member/dashboard">
                    Trang cá nhân
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>
                    Đăng xuất
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            )}
          </Nav>
        </Container>
      </Navbar>

      <main className="flex-grow-1">{children}</main>

      <footer className="bg-dark text-white-50 py-4 mt-5">
        <Container className="d-flex flex-wrap justify-content-between gap-2">
          <small>
            © {new Date().getFullYear()} SWP GYM — Sports Center Management System
          </small>
          <small>Liên hệ: support@scms.local</small>
        </Container>
      </footer>
    </div>
  );
}