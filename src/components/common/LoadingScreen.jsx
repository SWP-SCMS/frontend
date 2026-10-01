import { Spinner } from 'react-bootstrap';

export default function LoadingScreen({ label = 'Đang tải...' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="d-flex flex-column align-items-center justify-content-center py-5"
    >
      <Spinner animation="border" variant="danger" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
