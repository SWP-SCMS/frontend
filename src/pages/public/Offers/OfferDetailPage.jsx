// Offer detail page.
//
// Handoff §7:
//   GET /api/v1/membership-offers/{offerId}
//   - only ACTIVE offer
//   - nonexistent/INACTIVE -> 404 MEMBERSHIP_OFFER_NOT_FOUND
//   - malformed UUID -> 400 MALFORMED_REQUEST
//
// We treat any non-2xx as a "not found" surface — actual code mapping is
// handled by extractErrorMessage + backend contract.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import PublicShell from '../../../components/layout/PublicShell';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { getOfferById } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import { useAuth } from '../../../context/useAuth';

export default function OfferDetailPage() {
  const { offerId } = useParams();
  const { isAuthenticated } = useAuth();

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOfferById(offerId)
      .then((data) => {
        if (cancelled) return;
        setOffer(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [offerId]);

  return (
    <PublicShell>
      <section className="py-5">
        <div className="container">
          <Link to="/offers" className="text-decoration-none small">
            ← Quay lại danh sách
          </Link>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="danger" />
            </div>
          ) : error ? (
            <ErrorAlert
              error={error}
              title="Không tìm thấy ưu đãi"
            />
          ) : offer ? (
            <Card className="border-0 shadow-sm mt-3">
              <Card.Body className="p-4 p-md-5">
                <Row className="g-4">
                  <Col md={7}>
                    <span className="badge bg-dark mb-2">{offer.planCode}</span>
                    <h1 className="fw-bold mb-2">{offer.name}</h1>
                    <p className="text-muted">{offer.description || '—'}</p>
                    <ul className="mb-0">
                      {offer.supportsBooking ? (
                        <li>Đặt lịch Group / Yoga / PT 1-1</li>
                      ) : null}
                      {offer.supportsPersonalCoaching ? (
                        <li>Kèm Personal Coach</li>
                      ) : null}
                      <li>Thời hạn: {offer.durationDays} ngày</li>
                    </ul>
                  </Col>
                  <Col md={5}>
                    <div className="bg-body-tertiary rounded-3 p-4">
                      <div className="text-muted small mb-1">Giá</div>
                      <div className="display-6 fw-bold text-danger">
                        {formatPrice(offer.priceAmount, offer.currencyCode)}
                      </div>
                      <div className="text-muted small mb-3">
                        Cho {offer.durationDays} ngày sử dụng
                      </div>
                      {isAuthenticated ? (
                        <Button
                          as={Link}
                          to="/member/dashboard"
                          variant="danger"
                          className="w-100"
                        >
                          Mua trong Dashboard
                        </Button>
                      ) : (
                        <Button
                          as={Link}
                          to="/register"
                          variant="danger"
                          className="w-100"
                        >
                          Đăng ký để mua gói
                        </Button>
                      )}
                      <p className="small text-muted text-center mt-3 mb-0">
                        Bạn sẽ được hướng dẫn thanh toán sau khi đăng ký.
                      </p>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          ) : null}
        </div>
      </section>
    </PublicShell>
  );
}
