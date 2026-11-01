import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import { listReceptionCourseRefunds, getReceptionCourseRefund } from '../../../services/courseWorkflowService';
import { COURSE_ELIGIBILITY_LABELS, COURSE_REFUND_SOURCE_LABELS } from '../../../utils/courseWorkflow';
import { COURSE_RUN_STATUS_LABELS, formatCourseDateTime, formatCourseMoney, getCourseErrorMessage } from '../../../utils/courseUi';

function RefundSummary({ item }) {
  return <>
    <h2 className="h5">{item.memberName || 'Hội viên'} · {item.memberCode || 'Chưa có mã hội viên'}</h2>
    <p>{item.courseName || 'Khóa học'} · {item.courseCode || '—'} · {item.runCode || 'Đợt học'}</p>
    <p>Trạng thái đợt học: {COURSE_RUN_STATUS_LABELS[item.courseRunStatus] || 'Chưa có thông tin'}</p>
    <p>{COURSE_REFUND_SOURCE_LABELS[item.source] || 'Hoàn tiền khóa học'}</p>
    <p>Số tiền đã duyệt: <strong>{formatCourseMoney(item.amount)}</strong></p>
    <p>Ngày duyệt: {formatCourseDateTime(item.approvedAt)}</p>
    <Badge bg={item.disbursementEligible ? 'success' : 'warning'} text={item.disbursementEligible ? 'light' : 'dark'}>{COURSE_ELIGIBILITY_LABELS[item.disbursementEligibilityReason] || 'Chưa xác định điều kiện chi'}</Badge>
  </>;
}

export default function ReceptionCourseRefundPage() {
  const [page, setPage] = useState(0);
  const [eligible, setEligible] = useState('');
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRevision, setDetailRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    listReceptionCourseRefunds({ page, eligible: eligible === '' ? undefined : eligible === 'true' })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getCourseErrorMessage(err, 'Không tải được hàng chờ hoàn tiền khóa học.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, eligible, revision]);
  useEffect(() => {
    let active = true;
    setDetail(null); setDetailError(''); setDetailLoading(!!selectedId);
    if (selectedId) getReceptionCourseRefund(selectedId)
      .then((result) => { if (active) setDetail(result); })
      .catch((err) => { if (active) setDetailError(getCourseErrorMessage(err, 'Không tải được khoản hoàn. Khoản này có thể đã được xử lý và rời hàng chờ.')); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, detailRevision]);
  return <div className="container-fluid py-4">
    <h1 className="h3">Hàng chờ hoàn tiền khóa học</h1>
    <p>Các khoản đã được quản lý duyệt. Điều kiện chi được cập nhật theo trạng thái đợt học.</p>
    <Alert variant="info">Màn hình hiện hỗ trợ tra cứu khoản hoàn và điều kiện chi. Chức năng ghi nhận chi tại quầy chưa khả dụng; không xem trạng thái “đủ điều kiện chi” là đã trả tiền.</Alert>
    <div className="d-flex flex-wrap gap-3 mb-3">
      <Form.Select aria-label="Điều kiện chi" style={{ maxWidth: 320 }} value={eligible} disabled={loading} onChange={(event) => { setEligible(event.target.value); setPage(0); }}><option value="">Tất cả khoản đã duyệt</option><option value="true">Đủ điều kiện chi</option><option value="false">Chưa đủ điều kiện chi</option></Form.Select>
      <Button variant="outline-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Tải lại</Button>
    </div>
    {error && <Alert variant="danger">{error}</Alert>}
    {loading ? <p>Đang tải hàng chờ…</p> : data && <Card><Table responsive hover className="mb-0 align-middle"><thead><tr><th>Hội viên</th><th>Khóa học / đợt</th><th>Số tiền đã duyệt</th><th>Điều kiện chi</th><th /></tr></thead><tbody>
      {data.items.map((item) => <tr key={item.refundId}><td>{item.memberName || 'Hội viên'}<br /><small>{item.memberCode || 'Chưa có mã hội viên'}</small></td><td>{item.courseName || 'Khóa học'}<br /><small>{item.runCode || 'Đợt học'}</small></td><td>{formatCourseMoney(item.amount)}</td><td>{COURSE_ELIGIBILITY_LABELS[item.disbursementEligibilityReason] || 'Chưa xác định'}</td><td><Button size="sm" variant="outline-primary" onClick={() => setSelectedId(item.refundId)}>Chi tiết</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={5} className="text-center py-4">Không có khoản hoàn phù hợp.</td></tr>}
    </tbody></Table></Card>}
    <div className="d-flex gap-3 align-items-center mt-3"><Button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Trang trước</Button><span>Trang {page + 1}</span><Button disabled={loading || !data || page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Trang sau</Button></div>
    <Modal show={!!selectedId} onHide={() => setSelectedId('')} centered><Modal.Header closeButton><Modal.Title>Khoản hoàn đã duyệt</Modal.Title></Modal.Header><Modal.Body>
      {detailError && <Alert variant="danger">{detailError}</Alert>}
      {detailLoading ? <p>Đang tải…</p> : detail && <RefundSummary item={detail} />}
    </Modal.Body><Modal.Footer><Button variant="outline-primary" disabled={detailLoading} onClick={() => setDetailRevision((value) => value + 1)}>Tải lại</Button><Button variant="secondary" onClick={() => setSelectedId('')}>Đóng</Button></Modal.Footer></Modal>
  </div>;
}
