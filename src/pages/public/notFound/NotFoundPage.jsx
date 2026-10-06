// Simple 404 page rendered for any unknown route.

import { Link } from 'react-router-dom';
import { Button, Container } from 'react-bootstrap';
import PublicShell from '../../../components/layout/PublicShell';

import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <PublicShell>
      <Container className="py-5 text-center scms-404-wrap">
        <p className="text-muted text-uppercase fw-semibold mb-2">404</p>
        <h1 className="fw-bold mb-2">Không tìm thấy trang</h1>
        <p className="text-muted mb-4">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
        </p>
        <Button as={Link} to="/" variant="danger">
          Về trang chủ
        </Button>
      </Container>
    </PublicShell>
  );
}
