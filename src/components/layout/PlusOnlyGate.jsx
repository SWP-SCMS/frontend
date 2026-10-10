// Chặn các trang chỉ dành cho gói PLUS khi hội viên không có gói PLUS mà gõ
// thẳng đường dẫn (không bấm từ menu). Hiện thông báo thay cho nội dung trang.
//
// Đây chỉ là lớp giao diện: quyền thật vẫn do BE kiểm tra khi đặt lịch
// (BR-BKG-03/05, BR-SEC-04). Nếu chưa tải xong hoặc tải gói tập bị lỗi thì
// không chặn, để người dùng không bị khóa oan.

import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useMemberArea } from './MemberAreaContext';
import './PlusOnlyGate.css';

export default function PlusOnlyGate({ feature, children }) {
  const { isPlus, loading, error } = useMemberArea();

  if (loading) {
    return (
      <div className="plus-gate-center">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error || isPlus) return children;

  return (
    <div className="plus-gate">
      <span className="plus-gate-badge">PLUS</span>
      <h1 className="plus-gate-title">Cần đăng ký gói PLUS</h1>
      <p className="plus-gate-text">
        Bạn cần đăng ký gói PLUS để sử dụng dịch vụ &quot;{feature}&quot;.
      </p>
      <Link to="/member/plan" className="plus-gate-btn">
        Xem gói tập
      </Link>
    </div>
  );
}
