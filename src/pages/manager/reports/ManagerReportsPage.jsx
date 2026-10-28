import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Accordion, Button, Card, Col, Form, ProgressBar, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { RhfDateInput } from '../../../components/common/DateInput';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  getAttendanceReport,
  getBookingReport,
  getCenterVisitReport,
  getClassUtilizationReport,
  getMemberReport,
} from '../../../services/managerReportingService';
import './ManagerReportsPage.css';

const schema = z.object({
  from: z.string(),
  to: z.string(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' });
  }
});

const DEFAULT_FILTERS = { from: '', to: '' };

function count(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('vi-VN') : '—';
}

function percentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, numeric * 100));
}

function Metric({ label, value, description, tone = 'default' }) {
  return (
    <div className={`manager-report-metric manager-report-metric--${tone}`}>
      <div className="manager-report-metric__label">{label}</div>
      <div className="manager-report-metric__value">{value}</div>
      {description ? <div className="manager-report-metric__description">{description}</div> : null}
    </div>
  );
}

function RateMetric({ label, value, description, tone = 'success' }) {
  const numeric = percentage(value);
  return (
    <div className={`manager-report-metric manager-report-metric--${tone}`}>
      <div className="manager-report-metric__label">{label}</div>
      <div className="manager-report-metric__value">{numeric == null ? '—' : `${numeric.toFixed(1)}%`}</div>
      <ProgressBar
        className="manager-report-progress"
        variant={tone === 'danger' ? 'danger' : 'success'}
        now={numeric ?? 0}
        aria-label={label}
      />
      {description ? <div className="manager-report-metric__description">{description}</div> : null}
    </div>
  );
}

function ReportSection({ eventKey, title, description, children }) {
  return (
    <Accordion.Item eventKey={eventKey} className="manager-report-section border-0 shadow-sm">
      <Accordion.Header>
        <span>
          <span className="manager-report-section__title">{title}</span>
          <span className="manager-report-section__description">{description}</span>
        </span>
      </Accordion.Header>
      <Accordion.Body>
        <div className="manager-report-grid">{children}</div>
      </Accordion.Body>
    </Accordion.Item>
  );
}

export default function ManagerReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_FILTERS,
  });

  const loadReports = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const [members, bookings, attendance, centerVisits, classUtilization] = await Promise.all([
        getMemberReport(filters),
        getBookingReport(filters),
        getAttendanceReport(filters),
        getCenterVisitReport(filters),
        getClassUtilizationReport(filters),
      ]);
      setReports({ members, bookings, attendance, centerVisits, classUtilization });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(DEFAULT_FILTERS);
  }, [loadReports]);

  function clear() {
    reset(DEFAULT_FILTERS);
    loadReports(DEFAULT_FILTERS);
  }

  return (
    <div className="manager-reports-page">
      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Báo cáo vận hành</h1>
          <p className="text-muted mb-0">Tổng hợp tình hình hội viên, đặt lịch, điểm danh và sử dụng trung tâm.</p>
        </div>
        <Button as={Link} to="/manager/reports/revenue" variant="outline-danger">Xem báo cáo doanh thu</Button>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit(loadReports)}>
            <Row className="g-3 align-items-end">
              <Col md={3}>
                <Form.Label>Từ ngày</Form.Label>
                <RhfDateInput control={control} name="from" isInvalid={Boolean(errors.from)} />
                <Form.Control.Feedback type="invalid">{errors.from?.message}</Form.Control.Feedback>
              </Col>
              <Col md={3}>
                <Form.Label>Đến ngày</Form.Label>
                <RhfDateInput control={control} name="to" isInvalid={Boolean(errors.to)} />
                <Form.Control.Feedback type="invalid">{errors.to?.message}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="d-flex gap-2">
                <Button type="submit" variant="danger" disabled={loading}>{loading ? 'Đang tải…' : 'Lọc báo cáo'}</Button>
                <Button type="button" variant="outline-secondary" disabled={loading} onClick={clear}>Đặt lại</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <ErrorAlert error={error} title="Không tải được báo cáo vận hành" onClose={() => setError(null)} />
      {loading ? <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div> : null}

      {!loading && reports ? (
        <Accordion alwaysOpen defaultActiveKey={['members']} className="manager-report-accordion">
          <ReportSection eventKey="members" title="Hội viên" description="Tình trạng tài khoản và gói tập của hội viên trong hệ thống.">
            <Metric label="Tổng số hội viên" value={count(reports.members.totalMembers)} description="Tất cả tài khoản hội viên" />
            <Metric label="Đang hoạt động" value={count(reports.members.activeMembers)} description="Tài khoản có thể sử dụng dịch vụ" tone="success" />
            <Metric label="Đang tạm khóa" value={count(reports.members.suspendedMembers)} description="Tài khoản bị hạn chế sử dụng" tone="warning" />
            <Metric label="Gói tập còn hiệu lực" value={count(reports.members.activeMemberships)} tone="success" />
            <Metric label="Gói tập đã hết hạn" value={count(reports.members.expiredMemberships)} tone="muted" />
          </ReportSection>

          <ReportSection eventKey="bookings" title="Đặt lịch tập" description="Số lượt đặt và hủy lịch trong khoảng thời gian đã chọn.">
            <Metric label="Tổng lượt đặt" value={count(reports.bookings.totalBookings)} />
            <Metric label="Lịch đang hiệu lực" value={count(reports.bookings.bookedBookings)} tone="success" />
            <Metric label="Lịch đã hủy" value={count(reports.bookings.cancelledBookings)} tone="danger" />
          </ReportSection>

          <ReportSection eventKey="attendance" title="Điểm danh" description="Mức độ tham gia thực tế tại các buổi đủ điều kiện thống kê.">
            <Metric label="Buổi được thống kê" value={count(reports.attendance.reportableSessions)} />
            <Metric label="Lượt có mặt" value={count(reports.attendance.present)} tone="success" />
            <Metric label="Lượt vắng mặt" value={count(reports.attendance.absent)} tone="danger" />
            <RateMetric label="Tỷ lệ tham gia" value={reports.attendance.participationRate} description="Tỷ lệ có mặt trên tổng lượt đã điểm danh" />
          </ReportSection>

          <ReportSection eventKey="center-visits" title="Lượt vào trung tâm" description="Hoạt động check-in và checkout tại khu vực tập luyện.">
            <Metric label="Tổng lượt vào" value={count(reports.centerVisits.totalVisits)} />
            <Metric label="Hội viên đã đến" value={count(reports.centerVisits.uniqueMembers)} description="Số hội viên không trùng lặp" />
            <Metric label="Lượt chưa checkout" value={count(reports.centerVisits.openVisits)} description="Cần kiểm tra trước khi kết ca" tone="warning" />
          </ReportSection>

          <ReportSection eventKey="class-utilization" title="Mức sử dụng lớp" description="Khả năng khai thác sức chứa của các buổi tập được thống kê.">
            <Metric label="Tổng số buổi tập" value={count(reports.classUtilization.totalSessions)} />
            <Metric label="Buổi đã hủy" value={count(reports.classUtilization.cancelledSessions)} tone="danger" />
            <Metric label="Buổi được thống kê" value={count(reports.classUtilization.reportableSessions)} />
            <Metric label="Chỗ đã được đặt" value={count(reports.classUtilization.booked)} tone="success" />
            <Metric label="Tổng sức chứa" value={count(reports.classUtilization.totalCapacity)} />
            <Metric label="Lượt có mặt" value={count(reports.classUtilization.present)} tone="success" />
            <Metric label="Lượt vắng mặt" value={count(reports.classUtilization.absent)} tone="danger" />
            <RateMetric label="Tỷ lệ sử dụng" value={reports.classUtilization.utilizationRate} description="Chỗ đã sử dụng trên tổng sức chứa" />
          </ReportSection>
        </Accordion>
      ) : null}
    </div>
  );
}
