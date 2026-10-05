// Manager – Membership Offer detail (US08).
//
// Read-only view of a single offer. Provides an "Edit" link to the edit
// page. MembershipOfferResponse does NOT include `status`, `createdAt`,
// or `updatedAt`, so the status badge displays "—" until the backend
// extends the DTO.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
// We don't have a dedicated GET-by-id admin endpoint (the list endpoint
// already returns everything), so we re-use the list service. This keeps
// the FE working without inventing a non-existent endpoint.
import { listMembershipOffersAdmin } from '../../../services/membershipOfferAdminService';
import { formatDate, formatPrice } from '../../../utils';

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

const PLAN_BADGE = {
  BASIC: 'bg-info-subtle text-info-emphasis',
  PLUS: 'bg-warning-subtle text-warning-emphasis',
};

export default function MembershipOfferDetailPage() {
  const { offerId } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMembershipOffersAdmin();
      const found = list.find((o) => o.offerId === offerId);
      if (!found) {
        setError(
          new Error(
            'Không tìm thấy gói tập này. Có thể đã bị xoá hoặc bạn không có quyền truy cập.',
          ),
        );
      } else {
        setOffer(found);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div>
        <Link
          to="/manager/membership-offers"
          className="small text-decoration-none"
        >
          ← Quay lại danh sách
        </Link>
        <ErrorAlert
          className="mt-3"
          error={error}
          title="Không tải được gói tập"
        />
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/manager/membership-offers"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <div className="d-flex flex-wrap justify-content-between align-items-end mt-2 mb-3 gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{offer.name || '—'}</h1>
          <p className="text-muted mb-0">
            <span
              className={`badge me-2 ${
                PLAN_BADGE[offer.planCode] || 'bg-light text-dark'
              }`}
            >
              {offer.planCode || '—'}
            </span>
            {offer.planDisplayName || ''}
            {offer.status ? ` · ${offer.status}` : ''}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button
            as={Link}
            to={`/manager/membership-offers/${offer.offerId}/edit`}
            variant="outline-danger"
          >
            Chỉnh sửa
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Thông tin gói tập</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4 text-muted fw-normal">Offer ID</dt>
                <dd className="col-sm-8 text-break mb-2">
                  <code className="small">{offer.offerId}</code>
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Loại gói</dt>
                <dd className="col-sm-8 mb-2">
                  {offer.planCode || '—'}
                  {offer.planDisplayName ? ` · ${offer.planDisplayName}` : ''}
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Trạng thái</dt>
                <dd className="col-sm-8 mb-2">
                  <span
                    className={`badge ${
                      STATUS_BADGE[offer.status] || 'bg-light text-dark'
                    }`}
                  >
                    {offer.status || '—'}
                  </span>
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">
                  Thời hạn
                </dt>
                <dd className="col-sm-8 mb-0">
                  {offer.durationDays
                    ? `${offer.durationDays} ngày`
                    : '—'}
                </dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h2 className="h6 text-uppercase text-muted">Giá & quyền lợi</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4 text-muted fw-normal">Giá bán</dt>
                <dd className="col-sm-8 mb-2 fw-semibold">
                  {formatPrice(offer.priceAmount, offer.currencyCode)}
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">Tiền tệ</dt>
                <dd className="col-sm-8 mb-2">{offer.currencyCode || '—'}</dd>

                <dt className="col-sm-4 text-muted fw-normal">
                  Đặt lịch online
                </dt>
                <dd className="col-sm-8 mb-2">
                  {offer.supportsBooking ? 'Có' : 'Không'}
                </dd>

                <dt className="col-sm-4 text-muted fw-normal">
                  Coaching 1-1
                </dt>
                <dd className="col-sm-8 mb-0">
                  {offer.supportsPersonalCoaching ? 'Có' : 'Không'}
                </dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <h2 className="h6 text-uppercase text-muted">Mô tả</h2>
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {offer.description || '—'}
          </p>
        </Card.Body>
      </Card>

      {/* createdAt / updatedAt intentionally omitted — not surfaced by
          MembershipOfferResponse. Re-enable once the backend extends the DTO.
       */}
      {/* eslint-disable-next-line no-unused-vars */}
      {false && (
        <small className="text-muted d-block mt-3">
          Cập nhật lần cuối: {formatDate(offer.updatedAt)}
        </small>
      )}
    </div>
  );
}