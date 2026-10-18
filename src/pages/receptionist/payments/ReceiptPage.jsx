import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Row, Spinner, Stack } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getReceipt } from '../../../services/receptionistService';
import { formatPrice } from '../../../utils';
import { formatGymDate, formatGymTime } from '../../../utils/gymTime';
import { downloadReceiptPdf, paymentMethodLabel } from '../../../utils/receiptPdf';
import './ReceiptPage.css';

// A single printable receipt, rendered from GET /receipts/{receiptId}.
//
// ReceiptResponse (as of backend commit af38eaa) carries everything the
// printed sheet needs: receiptId, receiptNumber, paymentId, orderId,
// offerName, memberAccountId, memberName, memberCode, amount, currency,
// paymentMethod, issuedAt.
//
// Everything is therefore read from the API, never from navigation state, so
// the receipt is complete and correct when opened cold — from a bookmark, a
// reload, or a shared link. The `location.state` plumbing that used to supply
// the member name, code and plan has been removed.

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="receipt-row">
      <div className="receipt-label">{label}</div>
      <div className={`receipt-value${mono ? ' font-monospace' : ''}`}>{value ?? '—'}</div>
    </div>
  );
}

export default function ReceiptPage({ memberMode = false }) {
  const { receiptId } = useParams();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!receiptId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    setReceipt(null);

    getReceipt(receiptId)
      .then((data) => {
        if (active) setReceipt(data);
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [receiptId]);

  // All of these come from the API, so the printed sheet is identical whether
  // the page was reached from a payment or opened cold.
  const memberName = receipt?.memberName ?? null;
  const memberCode = receipt?.memberCode ?? null;
  const offerName = receipt?.offerName ?? null;
  // ReceiptResponse does not carry the plan duration. The backend has
  // membership_orders.duration_days_snapshot but does not expose it, so the
  // duration row is simply omitted from the sheet rather than guessed.
  const durationDays = null;

  const handleExport = useCallback(async () => {
    if (!receipt) return;
    setExporting(true);
    try {
      await downloadReceiptPdf({
        receipt,
        memberName,
        memberCode,
        offerName,
        durationDays,
      });
    } catch (err) {
      setError(err);
    } finally {
      setExporting(false);
    }
  }, [receipt, memberName, memberCode, offerName, durationDays]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error) {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    return (
      <>
        <ErrorAlert
          error={error}
          title="Không xem được biên lai"
          onClose={() => setError(null)}
        />
        {status === 403 || code === 'PAYMENT_FORBIDDEN' ? (
          <Alert variant="warning">
            <Alert.Heading className="h6 mb-1">Bạn không có quyền xem biên lai này</Alert.Heading>
            <div className="small">
              {memberMode
                ? 'Bạn chỉ có thể xem biên lai thuộc tài khoản của mình.'
                : 'Biên lai này có thể do nhân viên khác xử lý hoặc tài khoản của bạn không có quyền truy cập. Quản lý vẫn có thể xem mọi biên lai.'}
            </div>
          </Alert>
        ) : null}
        <Button as={Link} to={memberMode ? '/member/receipts' : '/reception/orders/new'} variant="outline-secondary" size="sm">
          {memberMode ? 'Về danh sách biên lai' : 'Về màn hình tạo đơn'}
        </Button>
      </>
    );
  }

  if (!receipt) return null;

  return (
    <div className="receipt-print-area">
      <Stack
        direction="horizontal"
        className="no-print mb-3 flex-wrap gap-2"
      >
        <div>
          <h1 className="h4 fw-bold mb-1">Biên lai {receipt.receiptNumber}</h1>
          <p className="text-muted small mb-0">
            In để khách giữ lại — đây là bằng chứng đã thanh toán.
          </p>
        </div>
        <div className="ms-auto d-flex gap-2">
          <Button variant="danger" size="sm" onClick={() => window.print()} disabled={exporting}>
            In biên lai
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? <Spinner animation="border" size="sm" /> : 'Tải PDF'}
          </Button>
        </div>
      </Stack>

      <Row>
        <Col lg={8}>
          <Card className="receipt-sheet border-0 shadow-sm">
            <Card.Body className="p-4">
              <div className="text-center mb-3">
                <h2 className="h5 fw-bold mb-1">BIÊN LAI THU TIỀN</h2>
                <div className="text-muted small">SWP GYM — Trung tâm quản lý hội viên</div>
              </div>

              <DetailRow label="Số biên lai" value={receipt.receiptNumber} />
              <DetailRow label="Ngày xuất" value={`${formatGymDate(receipt.issuedAt)} · ${formatGymTime(receipt.issuedAt)}`} />
              <DetailRow label="Hội viên" value={memberName} />
              <DetailRow label="Mã hội viên" value={memberCode} />
              <DetailRow label="Gói tập" value={offerName} />
              <DetailRow label="Phương thức" value={paymentMethodLabel(receipt.paymentMethod)} />

              <div className="border-top border-bottom my-3 py-3 text-center">
                <div className="text-muted small mb-1">Số tiền đã thanh toán</div>
                <div className="receipt-amount">
                  {formatPrice(receipt.amount, receipt.currency)}
                </div>
              </div>

              <div className="receipt-issued-by text-center">
                Cảm ơn quý khách. Vui lòng giữ lại biên lai này.
              </div>

              <div className="receipt-signature">
                <div>
                  Người mua
                  <div className="receipt-signature-line">&nbsp;</div>
                </div>
                <div>
                  Người nhận
                  <div className="receipt-signature-line">&nbsp;</div>
                </div>
              </div>

            </Card.Body>
          </Card>
        </Col>
      </Row>

      <div className="no-print mt-3 d-flex gap-2">
        <Button as={Link} to={memberMode ? '/member/receipts' : '/reception/orders/new'} variant="outline-secondary" size="sm">
          {memberMode ? 'Về danh sách biên lai' : 'Về màn hình tạo đơn'}
        </Button>
        {!memberMode && memberCode ? (
          <Button
            as={Link}
            to={`/reception/members/${memberCode}`}
            variant="outline-secondary"
            size="sm"
          >
            Hồ sơ hội viên
          </Button>
        ) : null}
      </div>
    </div>
  );
}
