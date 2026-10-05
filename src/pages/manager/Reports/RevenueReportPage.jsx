// Manager – Revenue / Membership report (US22).
//
// BE: GET /api/v1/manager/reports/membership-revenue
//        ?from&to&includeTestData
//
// Business rules surfaced by this page:
//   - BR-RPT-02 — revenue only counts PAID payments. PENDING/FAILED appear
//     as counts to give the manager context, but never as money.
//   - BR-RPT-01 — report is MANAGER-scoped (BE enforces the role).
//
// Two caveats the UI makes explicit rather than hiding:
//   1. The BE treats `to` as an EXCLUSIVE upper bound, so the date picker
//      offers an inclusive "Đến ngày" and the service shifts it by a day.
//   2. activeMemberships / expiredMemberships are NOT filtered by the
//      selected range — the BE counts today's membership state. We label
//      them as a snapshot so the manager doesn't read them as period totals.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { fetchRevenueReport } from '../../../services/revenueReportService';
import { formatDate, formatPrice } from '../../../utils';

// Sentinel used for "no date selected" in the two date inputs. Using a
// string (rather than null) keeps the inputs controlled.
const EMPTY = '';

// Fields the BE always returns; keeps the render path stable while a
// request is in flight.
const EMPTY_REPORT = {
  paidPayments: 0,
  paidRevenue: 0,
  pendingPayments: 0,
  failedPayments: 0,
  activeMemberships: 0,
  expiredMemberships: 0,
};

function toDateInputValue(date) {
  if (!date) return EMPTY;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function buildRangeError(from, to) {
  if (!from || !to) return null;
  if (from > to) return 'Ngày bắt đầu không được sau ngày kết thúc.';
  return null;
}

export default function RevenueReportPage() {
  const [from, setFrom] = useState(toDateInputValue(daysAgo(29)));
  const [to, setTo] = useState(toDateInputValue(new Date()));
  const [includeTestData, setIncludeTestData] = useState(false);

  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const rangeError = useMemo(() => buildRangeError(from, to), [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRevenueReport({ from, to, includeTestData });
      setReport({ ...EMPTY_REPORT, ...data });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [from, to, includeTestData]);

  useEffect(() => {
    load();
  }, [load]);

  function handleReset() {
    setFrom(EMPTY);
    setTo(EMPTY);
    setIncludeTestData(false);
  }

  function applyPreset(days) {
    setFrom(toDateInputValue(daysAgo(days - 1)));
    setTo(toDateInputValue(new Date()));
  }

  const paid = Number(report.paidPayments) || 0;
  const revenue = Number(report.paidRevenue) || 0;
  const pending = Number(report.pendingPayments) || 0;
  const failed = Number(report.failedPayments) || 0;
  const active = Number(report.activeMemberships) || 0;
  const expired = Number(report.expiredMemberships) || 0;

  const totalPayments = paid + pending + failed;
  const successRate = totalPayments > 0 ? (paid / totalPayments) * 100 : null;
  const avgTicket = paid > 0 ? revenue / paid : null;

  // Payment-status rows are derived from the same counters the revenue
  // figure comes from — never recomputed from an independent source so
  // the table and the KPI cards can never disagree.
  const paymentRows = useMemo(
    () => [
      {
        key: 'PAID',
        label: 'Đã thanh toán',
        count: paid,
        isRevenue: true,
        variant: 'success',
        note: 'Được tính vào doanh thu',
      },
      {
        key: 'PENDING',
        label: 'Đang chờ',
        count: pending,
        isRevenue: false,
        variant: 'warning',
        note: 'Không tính vào doanh thu',
      },
      {
        key: 'FAILED',
        label: 'Thất bại',
        count: failed,
        isRevenue: false,
        variant: 'danger',
        note: 'Không tính vào doanh thu',
      },
    ],
    [paid, pending, failed],
  );

  return (
    <div>
      <header className="mb-3">
        <h1 className="h3 fw-bold mb-1">Báo cáo doanh thu</h1>
        <p className="text-muted mb-0">
          Tổng hợp doanh thu gói tập và tình hình Membership (BR-RPT-01,
          BR-RPT-02).
        </p>
      </header>

      {/* ---------- Filters ---------- */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4} lg={3}>
              <Form.Label htmlFor="report-from" className="small mb-1">
                Từ ngày
              </Form.Label>
              <Form.Control
                id="report-from"
                type="date"
                size="sm"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Col>
            <Col md={4} lg={3}>
              <Form.Label htmlFor="report-to" className="small mb-1">
                Đến ngày
              </Form.Label>
              <Form.Control
                id="report-to"
                type="date"
                size="sm"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </Col>
            <Col md={4} lg={3}>
              <Form.Label className="small mb-1 d-block">
                Khoảng thời gian
              </Form.Label>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => applyPreset(7)}
                >
                  7 ngày
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => applyPreset(30)}
                >
                  30 ngày
                </Button>
              </div>
            </Col>
            <Col md={12} lg={3}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Form.Check
                  type="switch"
                  id="report-include-test"
                  checked={includeTestData}
                  onChange={(e) => setIncludeTestData(e.target.checked)}
                  label="Gồm dữ liệu test"
                />
              </div>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={load}
                  disabled={loading || Boolean(rangeError)}
                >
                  {loading ? 'Đang tải…' : 'Xem báo cáo'}
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Đặt lại
                </Button>
              </div>
            </Col>
          </Row>

          {rangeError ? (
            <div className="mt-2">
              <Alert variant="warning" className="py-2 px-3 mb-0 small">
                {rangeError}
              </Alert>
            </div>
          ) : null}
        </Card.Body>
      </Card>

      <ErrorAlert
        error={error}
        title="Không tải được báo cáo"
        onClose={error?.response ? () => setError(null) : undefined}
      />

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      ) : (
        <>
          {/* ---------- KPI cards ---------- */}
          <Row className="g-3 mb-3">
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">
                    Doanh thu gói tập (PAID)
                  </div>
                  <div className="h4 fw-bold mb-0">
                    {formatPrice(revenue, 'VND')}
                  </div>
                  <div className="text-muted small mt-1">
                    {paid} giao dịch đã thanh toán
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">
                    Membership đang hiệu lực
                  </div>
                  <div className="h4 fw-bold mb-0">{active}</div>
                  <div className="text-muted small mt-1">
                    Ảnh chụp tại thời điểm xem — không lọc theo khoảng
                    ngày.
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">
                    Membership đã hết hạn
                  </div>
                  <div className="h4 fw-bold mb-0">{expired}</div>
                  <div className="text-muted small mt-1">
                    Ảnh chụp tại thời điểm xem — không lọc theo khoảng
                    ngày.
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-3 mb-3">
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">Tỉ lệ thành công</div>
                  <div className="h5 fw-bold mb-0">
                    {successRate == null
                      ? '—'
                      : `${successRate.toFixed(1)}%`}
                  </div>
                  <div className="text-muted small mt-1">
                    {paid}/{totalPayments || 0} giao dịch trong khoảng.
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">
                    Doanh thu trung bình / giao dịch
                  </div>
                  <div className="h5 fw-bold mb-0">
                    {avgTicket == null ? '—' : formatPrice(avgTicket, 'VND')}
                  </div>
                  <div className="text-muted small mt-1">
                    Chỉ tính các giao dịch PAID.
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small">
                    Chờ xác nhận / Thất bại
                  </div>
                  <div className="h5 fw-bold mb-0">
                    {pending} / {failed}
                  </div>
                  <div className="text-muted small mt-1">
                    Không tính vào doanh thu (BR-RPT-02).
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* ---------- Payment breakdown ---------- */}
          <Card className="border-0 shadow-sm mb-3">
            <Card.Body>
              <h2 className="h6 fw-bold mb-3">
                Phân bổ trạng thái thanh toán
              </h2>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Trạng thái</th>
                      <th className="text-end">Số giao dịch</th>
                      <th className="text-end">Tỉ trọng</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <span
                            className={`badge text-bg-${row.variant}`}
                          >
                            {row.label}
                          </span>
                        </td>
                        <td className="text-end">{row.count}</td>
                        <td className="text-end">
                          {totalPayments > 0
                            ? `${((row.count / totalPayments) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="text-muted small">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <th>Tổng</th>
                      <th className="text-end">{totalPayments}</th>
                      <th className="text-end">100%</th>
                      <th className="text-muted small">
                        Doanh thu tính trên {paid} giao dịch PAID.
                      </th>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </Card.Body>
          </Card>

          <p className="text-muted small mb-0">
            Khoảng thời gian: {formatDate(from)} – {formatDate(to)}
            {includeTestData
              ? ' · Đang tính cả dữ liệu test'
              : ' · Đã loại dữ liệu test'}
            . Doanh thu chỉ gồm giao dịch PAID; PENDING và FAILED được
            loại trừ theo BR-RPT-02.
          </p>
        </>
      )}
    </div>
  );
}