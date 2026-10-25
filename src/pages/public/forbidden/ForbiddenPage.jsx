import { Button, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

import PublicShell from '../../../components/layout/PublicShell';
import { ROLES } from '../../../constants';
import { useAuth } from '../../../context/useAuth';
import '../notFound/NotFoundPage.css';

const HOME_BY_ROLE = {
  [ROLES.MEMBER]: '/member/dashboard',
  [ROLES.RECEPTIONIST]: '/reception/check-in',
  [ROLES.COACH]: '/coach/dashboard',
  [ROLES.MANAGER]: '/manager/dashboard',
};

export default function ForbiddenPage() {
  const { role } = useAuth();
  const location = useLocation();
  const home = HOME_BY_ROLE[role] || '/';

  return (
    <PublicShell>
      <Container className="py-5 text-center scms-404-wrap">
        <p className="text-muted text-uppercase fw-semibold mb-2">Không có quyền truy cập</p>
        <h1 className="fw-bold mb-2">Trang này không dành cho tài khoản của bạn</h1>
        <p className="text-muted mb-4">
          Tài khoản hiện tại không có quyền mở
          {location.state?.from ? ` “${location.state.from}”` : ' đường dẫn này'}.
        </p>
        <Button as={Link} to={home} variant="danger">
          Về trang tổng quan
        </Button>
      </Container>
    </PublicShell>
  );
}
