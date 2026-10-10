// Header cố định (giao diện tối) của các trang công khai: trang chủ, bảng gói
// tập... Tách ra từ HomePage.jsx để dùng chung.
//
// Điều hướng:
//   - Trang chủ / Gói tập         -> "/" và "/offers" (menu `active` sáng lên)
//   - Chưa đăng nhập              -> Đăng nhập (/login), Đăng ký thành viên (/register)
//   - Đã đăng nhập                -> Trang cá nhân theo vai trò, Đăng xuất
//
// CSS dùng chung nằm trong HomePage.css (class .scms-home-*); trang bao ngoài
// phải có class `scms-home` (xem PublicDarkLayout.jsx).

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import BrandLogo from '../common/BrandLogo';
import '../../pages/public/home/HomePage.css';

export default function PublicHeader({ active = 'home' }) {
  const { isAuthenticated, isReady, user, logout } = useAuth();
  const navigate = useNavigate();

  // "Trang cá nhân" dẫn tới màn hình riêng của từng vai trò.
  const personalHomePath = useMemo(() => {
    switch (user?.role) {
      case 'MEMBER':
        return '/member/dashboard';
      case 'MANAGER':
        return '/manager/dashboard';
      case 'RECEPTIONIST':
        return '/reception';
      case 'COACH':
        return '/coach';
      default:
        return '/login';
    }
  }, [user?.role]);

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <header className="scms-home-header">
      <BrandLogo />

      <nav className="scms-home-nav d-none d-md-flex">
        <Link to="/" className={active === 'home' ? 'active' : ''}>
          Trang chủ
        </Link>
        <Link to="/offers" className={active === 'offers' ? 'active' : ''}>
          Gói tập
        </Link>
      </nav>

      <div className="scms-home-actions">
        {isReady && isAuthenticated ? (
          <>
            <span className="d-none d-md-inline small text-secondary">
              {user?.fullName || 'Tài khoản'}
            </span>
            <Link
              to={personalHomePath}
              className="scms-home-btn scms-home-btn-ghost"
            >
              Trang cá nhân
            </Link>
            <button
              type="button"
              className="scms-home-btn scms-home-btn-primary"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="scms-home-btn scms-home-btn-ghost d-none d-sm-inline-flex"
            >
              Đăng nhập
            </Link>
            <Link to="/register" className="scms-home-btn scms-home-btn-primary">
              Đăng ký thành viên
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
