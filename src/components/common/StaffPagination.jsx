import { Button } from 'react-bootstrap';

export default function StaffPagination({ page, totalPages, totalElements, loading, onPageChange }) {
  const pages = Math.max(1, totalPages || 1);
  return <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2 border-top">
    <small className="text-muted">Trang {page + 1} / {pages}{totalElements != null ? ` · Tổng ${totalElements} kết quả` : ''}</small>
    <div className="d-flex gap-2">
      <Button size="sm" variant="outline-secondary" disabled={loading || page === 0} onClick={() => onPageChange(page - 1)}>← Trang trước</Button>
      <Button size="sm" variant="outline-secondary" disabled={loading || page + 1 >= pages} onClick={() => onPageChange(page + 1)}>Trang sau →</Button>
    </div>
  </div>;
}
