import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { listAuditEvents } from '../../../services/auditService';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';

const ACTION_LABELS = {
  SESSION_CANCELLED: 'Hủy buổi tập',
  SESSION_ROOM_CHANGED: 'Đổi phòng tập',
  SESSION_RESCHEDULED: 'Đổi lịch buổi tập',
  ROOM_CREATED: 'Tạo phòng tập',
  ROOM_UPDATED: 'Cập nhật phòng tập',
  ROOM_SUSPENDED: 'Tạm ngưng phòng tập',
  ROOM_REACTIVATED: 'Mở lại phòng tập',
  COACH_ASSIGNED: 'Phân công huấn luyện viên',
  COACH_REASSIGNED: 'Đổi huấn luyện viên',
  COACH_ASSIGNMENT_ENDED: 'Kết thúc phân công huấn luyện viên',
  CENTER_VISIT_CREATED: 'Check-in trung tâm',
  CENTER_VISIT_CHECKED_OUT: 'Checkout trung tâm',
  SPORT_CLASS_CREATED: 'Tạo lớp học',
  SPORT_CLASS_UPDATED: 'Cập nhật lớp học',
  BOOKING_CREATED: 'Đặt lịch tập',
  BOOKING_CANCELLED: 'Hủy lịch tập',
  MEMBERSHIP_ORDER_CREATED: 'Tạo đơn đăng ký gói tập',
  MEMBERSHIP_ACTIVATED: 'Kích hoạt gói tập',
  PAYMENT_RECORDED: 'Ghi nhận thanh toán',
  RECEIPT_ISSUED: 'Phát hành biên lai',
  MEMBERSHIP_PLAN_CREATED: 'Tạo loại gói tập',
  MEMBERSHIP_PLAN_UPDATED: 'Cập nhật loại gói tập',
  MEMBERSHIP_OFFER_CREATED: 'Tạo gói tập',
  MEMBERSHIP_OFFER_UPDATED: 'Cập nhật gói tập',
  TRAINING_PLAN_CREATED: 'Tạo kế hoạch tập luyện',
  TRAINING_PLAN_UPDATED: 'Cập nhật kế hoạch tập luyện',
  TRAINING_RESULT_CREATED: 'Ghi nhận kết quả tập luyện',
  TRAINING_RESULT_UPDATED: 'Cập nhật kết quả tập luyện',
  TRAINING_FEEDBACK_CREATED: 'Tạo nhận xét tập luyện',
  TRAINING_FEEDBACK_UPDATED: 'Cập nhật nhận xét tập luyện',
};

const TARGET_LABELS = {
  CLASS_SESSION: 'Buổi tập',
  ROOM: 'Phòng tập',
  ROOM_SUSPENSION: 'Lịch tạm ngưng phòng',
  COACH_ASSIGNMENT: 'Phân công huấn luyện viên',
  CENTER_VISIT: 'Lượt vào trung tâm',
  SPORT_CLASS: 'Lớp học',
  BOOKING: 'Lịch đặt',
  MEMBERSHIP: 'Gói tập của hội viên',
  MEMBERSHIP_ORDER: 'Đơn đăng ký gói tập',
  PAYMENT: 'Thanh toán',
  RECEIPT: 'Biên lai',
  ACCOUNT: 'Tài khoản',
  MEMBER_PROFILE: 'Hồ sơ hội viên',
  MEMBERSHIP_PLAN: 'Loại gói tập',
  MEMBERSHIP_OFFER: 'Gói tập',
  TRAINING_PLAN: 'Kế hoạch tập luyện',
  TRAINING_RESULT: 'Kết quả tập luyện',
  TRAINING_FEEDBACK: 'Nhận xét tập luyện',
};

const ROLE_LABELS = {
  MEMBER: 'Hội viên',
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
};

const FIELD_LABELS = {
  status: 'Trạng thái',
  name: 'Tên',
  capacity: 'Sức chứa',
  cancelledBookings: 'Số lịch đặt đã hủy',
  startTime: 'Thời gian bắt đầu',
  endTime: 'Thời gian kết thúc',
  reason: 'Lý do',
};

const VALUE_LABELS = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  SUSPENDED: 'Tạm ngưng',
  SCHEDULED: 'Đã lên lịch',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  PAID: 'Đã thanh toán',
  PENDING: 'Đang chờ xử lý',
};

const filterSchema = z.object({
  action: z.string().max(120),
  targetType: z.string().max(80),
  from: z.string(),
  to: z.string(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' });
  }
});

const EMPTY_FILTERS = { action: '', targetType: '', from: '', to: '' };

function humanize(value, fallback = 'Không xác định') {
  if (!value) return fallback;
  const text = String(value).replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
  return text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1);
}

function actionLabel(value) {
  return ACTION_LABELS[value] || humanize(value, 'Hoạt động hệ thống');
}

function targetLabel(value) {
  return TARGET_LABELS[value] || humanize(value, 'Đối tượng hệ thống');
}

function actorIdentity(event) {
  if (!event.actorAccountId) return { name: 'Hệ thống', role: '' };
  return {
    name: event.actorName?.trim() || 'Nhân viên hệ thống',
    role: ROLE_LABELS[event.actorRole] || humanize(event.actorRole, ''),
  };
}

function displayValue(value) {
  if (value == null || value === '') return 'Không có';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (VALUE_LABELS[value]) return VALUE_LABELS[value];
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return `${formatGymDate(value)} · ${formatGymTime(value)}`;
  }
  return String(value);
}

function visibleDetails(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data)
    .filter(([, value]) => value == null || typeof value !== 'object')
    .filter(([key]) => !key.toLocaleLowerCase('en-US').endsWith('id'))
    .map(([key, value]) => ({ label: FIELD_LABELS[key] || humanize(key), value: displayValue(value) }));
}

function DetailList({ title, data }) {
  const details = visibleDetails(data);
  if (details.length === 0) return null;
  return (
    <div className="mt-2">
      <strong className="small">{title}</strong>
      <ul className="small mb-0 ps-3">
        {details.map((item) => <li key={item.label}>{item.label}: {item.value}</li>)}
      </ul>
    </div>
  );
}

export default function AuditHistoryPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: EMPTY_FILTERS,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listAuditEvents({ ...filters, page, size: 20 })
      .then((data) => { if (active) setResult(data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  function apply(values) {
    setPage(0);
    setFilters(values);
  }

  function clear() {
    reset(EMPTY_FILTERS);
    setPage(0);
    setFilters(EMPTY_FILTERS);
  }

  const rows = result?.content || [];

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">Lịch sử hoạt động</h1>
        <p className="text-muted mb-0">Theo dõi các thao tác quan trọng trong hệ thống.</p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit(apply)}>
            <Row className="g-3">
              <Col md={3}>
                <Form.Label>Hoạt động</Form.Label>
                <Form.Select {...register('action')}>
                  <option value="">Tất cả hoạt động</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </Col>
              <Col md={3}>
                <Form.Label>Đối tượng</Form.Label>
                <Form.Select {...register('targetType')}>
                  <option value="">Tất cả đối tượng</option>
                  {Object.entries(TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label>Từ ngày</Form.Label>
                <Form.Control type="date" {...register('from')} />
              </Col>
              <Col md={2}>
                <Form.Label>Đến ngày</Form.Label>
                <Form.Control type="date" {...register('to')} isInvalid={Boolean(errors.to)} />
                <Form.Control.Feedback type="invalid">{errors.to?.message}</Form.Control.Feedback>
              </Col>
              <Col md={2} className="d-flex align-items-end gap-2">
                <Button type="submit" variant="danger">Lọc</Button>
                <Button type="button" variant="outline-secondary" onClick={clear}>Xóa lọc</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <ErrorAlert error={error} title="Không tải được lịch sử hoạt động" onClose={() => setError(null)} />

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>
      ) : rows.length === 0 ? (
        <Alert variant="light" className="border">Không có hoạt động phù hợp.</Alert>
      ) : (
        <div className="table-responsive">
          <Table hover className="align-middle bg-white shadow-sm">
            <thead><tr><th>Thời điểm</th><th>Hoạt động</th><th>Đối tượng</th><th>Người thực hiện</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {rows.map((event) => {
                const hasDetails = Boolean(event.reason) || visibleDetails(event.beforeData).length > 0 || visibleDetails(event.afterData).length > 0;
                const actor = actorIdentity(event);
                return (
                  <tr key={event.id}>
                    <td>{formatGymDate(event.createdAt)} · {formatGymTime(event.createdAt)}</td>
                    <td>{actionLabel(event.action)}</td>
                    <td>{targetLabel(event.targetType)}</td>
                    <td>
                      <div className="fw-semibold">{actor.name}</div>
                      {actor.role ? <div className="small text-muted">{actor.role}</div> : null}
                    </td>
                    <td>
                      {hasDetails ? (
                        <details>
                          <summary>Xem chi tiết</summary>
                          {event.reason ? <p className="small mt-2 mb-1"><strong>Lý do:</strong> {event.reason}</p> : null}
                          <DetailList title="Trước thay đổi" data={event.beforeData} />
                          <DetailList title="Sau thay đổi" data={event.afterData} />
                        </details>
                      ) : <span className="text-muted">Không có chi tiết</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {result && result.totalPages > 1 ? (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <Button size="sm" variant="outline-secondary" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</Button>
          <span className="text-muted small">Trang {page + 1}/{result.totalPages} · {result.totalElements} hoạt động</span>
          <Button size="sm" variant="outline-secondary" disabled={page + 1 >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</Button>
        </div>
      ) : null}
    </div>
  );
}
