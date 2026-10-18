import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { listMyReceipts } from '../../../services/memberReceiptService';
import { formatPrice } from '../../../utils';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

export default function MemberReceiptListPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setReceipts(await listMyReceipts()); } catch (err) { setError(err); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-4">
        <div><h1 className="h3 fw-bold mb-1">Biên lai của tôi</h1><p className="text-muted mb-0">Các khoản thanh toán đã hoàn tất và biên lai tương ứng.</p></div>
        <Button variant="outline-danger" size="sm" onClick={load} disabled={loading}>Tải lại</Button>
      </div>
      <ErrorAlert error={error} title="Không tải được danh sách biên lai" />
      {loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : receipts.length === 0 ? (
        <Alert variant="light" className="border">Bạn chưa có biên lai thanh toán nào.</Alert>
      ) : (
        <div className="table-responsive"><Table hover className="align-middle bg-white shadow-sm">
          <thead><tr><th>Số biên lai</th><th>Gói tập</th><th>Ngày xuất</th><th className="text-end">Số tiền</th><th /></tr></thead>
          <tbody>{receipts.map((receipt) => <tr key={receipt.receiptId}>
            <td className="fw-semibold">{receipt.receiptNumber}</td><td>{receipt.offerName || '—'}</td>
            <td>{formatGymDate(receipt.issuedAt)} · {formatGymTime(receipt.issuedAt)}</td>
            <td className="text-end">{formatPrice(receipt.amount, receipt.currency)}</td>
            <td className="text-end"><Button as={Link} to={`/member/receipts/${receipt.receiptId}`} variant="outline-danger" size="sm">Xem</Button></td>
          </tr>)}</tbody>
        </Table></div>
      )}
    </div>
  );
}
