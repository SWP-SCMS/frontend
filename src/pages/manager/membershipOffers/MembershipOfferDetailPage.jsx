// Manager – Membership Offer detail (US08).
//
// Read-only view of a single offer. The dedicated detail endpoint returns
// MembershipOfferAdminDetailResponse, including status and resolved Benefits.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import { getMembershipOfferAdmin } from '../../../services/membershipOfferAdminService';
import { formatPrice } from '../../../utils';

const STATUS_BADGE = {
  ACTIVE: 'bg-success-subtle text-success-emphasis',
  INACTIVE: 'bg-secondary-subtle text-secondary-emphasis',
};

function displayLoadError(error) {
  if (error?.response?.data?.code === 'MEMBERSHIP_OFFER_NOT_FOUND') {
    return new Error(
      'Không tìm thấy gói tập này. Gói có thể đã bị xoá hoặc đường dẫn không còn hợp lệ.',
    );
  }
  return error;
}

export default function MembershipOfferDetailPage() {
  const { offerId } = useParams();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOffer(await getMembershipOfferAdmin(offerId));
    } catch (err) {
      setOffer(null);
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
          error={displayLoadError(error)}
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
                'bg-light text-dark'
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

              </dl>

              <div className="border-top pt-3 mt-3">
                <h3 className="small fw-semibold mb-2">Quyền lợi của gói</h3>
                <MembershipBenefitList
                  benefitCodes={offer.benefitCodes}
                  benefits={offer.benefits}
                  showDescription
                  emptyMessage="Gói này không có quyền lợi được cấu hình."
                />
              </div>
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

    </div>
  );
}
