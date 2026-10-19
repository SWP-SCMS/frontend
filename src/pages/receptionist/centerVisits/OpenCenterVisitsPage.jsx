import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Modal, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { checkoutMemberCenterVisit, listOpenCenterVisits } from '../../../services/centerVisitService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

export default function OpenCenterVisitsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listOpenCenterVisits({ page, size: 20 }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openCheckout(visit) {
    setSelected(visit);
  }

  function closeCheckout() {
    setSelected(null);
  }

  async function confirmCheckout() {
    if (!selected) return;
    setCheckingOut(true);
    setError(null);
    try {
      await checkoutMemberCenterVisit(selected.memberId);
      const memberLabel = selected.memberName
        ? `${selected.memberName} (${selected.memberCode})`
        : selected.memberCode || 'hội viên';
      setNotice(`Đã checkout ${memberLabel}.`);
      closeCheckout();
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setCheckingOut(false);
    }
  }

  const rows = result?.content || [];

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-4">
        <div><h1 className="h3 fw-bold mb-1">Lượt vào trung tâm đang mở</h1><p className="text-muted mb-0">Checkout cho hội viên đã rời trung tâm nhưng chưa tự checkout.</p></div>
        <Button variant="outline-danger" size="sm" onClick={load} disabled={loading}>Tải lại</Button>
      </div>
      {notice ? <Alert variant="success" dismissible onClose={() => setNotice('')}>{notice}</Alert> : null}
      <ErrorAlert error={error} title="Không xử lý được lượt vào trung tâm" onClose={() => setError(null)} />
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : rows.length === 0 ? (
        <Alert variant="success">Hiện không có lượt vào trung tâm nào đang mở.</Alert>
      ) : (
        <div className="table-responsive">
          <Table hover className="align-middle bg-white shadow-sm">
            <thead><tr><th>Hội viên</th><th>Check-in lúc</th><th className="text-end">Thao tác</th></tr></thead>
            <tbody>{rows.map((visit) => (
              <tr key={visit.id}>
                <td>
                  <div className="fw-semibold">{visit.memberName || 'Chưa có tên hội viên'}</div>
                  {visit.memberCode ? <Link className="small" to={`/reception/members/${encodeURIComponent(visit.memberCode)}`}>{visit.memberCode}</Link> : <span className="small text-muted">Chưa có mã hội viên</span>}
                </td>
                <td>{formatGymDate(visit.checkedInAt)} · {formatGymTime(visit.checkedInAt)}</td>
                <td className="text-end"><Button size="sm" variant="outline-danger" onClick={() => openCheckout(visit)}>Checkout</Button></td>
              </tr>
            ))}</tbody>
          </Table>
        </div>
      )}
      {result && result.totalPages > 1 ? (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Button variant="outline-secondary" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
          <span className="small text-muted">Trang {page + 1}/{result.totalPages} · {result.totalElements} lượt đang mở</span>
          <Button variant="outline-secondary" size="sm" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
        </div>
      ) : null}
      <Modal show={Boolean(selected)} onHide={() => (checkingOut ? null : closeCheckout())} centered>
        <Modal.Header closeButton={!checkingOut}><Modal.Title className="h5">Xác nhận checkout</Modal.Title></Modal.Header>
        <Modal.Body>
          <div>Đóng lượt vào đang mở của:</div>
          <div className="fw-bold mt-2">{selected?.memberName || 'Chưa có tên hội viên'}</div>
          <div className="text-muted small">Mã hội viên: {selected?.memberCode || '—'}</div>
        </Modal.Body>
        <Modal.Footer><Button variant="outline-secondary" disabled={checkingOut} onClick={closeCheckout}>Đóng</Button><Button variant="danger" disabled={checkingOut} onClick={confirmCheckout}>{checkingOut ? 'Đang checkout…' : 'Xác nhận checkout'}</Button></Modal.Footer>
      </Modal>
    </div>
  );
}
