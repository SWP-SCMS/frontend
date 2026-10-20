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

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Row, Spinner } from 'react-bootstrap';
import PublicShell from '../../../components/layout/PublicShell';
import MembershipBenefitList from '../../../components/common/MembershipBenefitList';
import { getOfferById } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import { useAuth } from '../../../context/useAuth';
import { hasBenefitContract } from '../../../utils/membershipBenefits';
import { buildFeatures } from './offerUtils';

export default function OfferDetailPage() {
  const { offerId } = useParams();
  const { isAuthenticated } = useAuth();

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    setOffer(null);
    try {
      const data = await getOfferById(offerId);
      if (!signal?.aborted) setOffer(data);
    } catch (err) {
      if (!signal?.aborted) setError(err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);

    return () => {
      controller.abort();
    };
  }, [load]);

  const errorCode = error?.response?.data?.code;
  const errorStatus = error?.response?.status;
  const invalidOffer =
    errorStatus === 400 ||
    errorStatus === 404 ||
    errorCode === 'MALFORMED_REQUEST' ||
    errorCode === 'MEMBERSHIP_OFFER_NOT_FOUND';
  const errorMessage = invalidOffer
    ? 'Gói tập không tồn tại, không còn mở bán hoặc đường dẫn không hợp lệ.'
    : error?.response
      ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.'
      : 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';

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
            <Alert variant="danger" className="mt-3">
              <Alert.Heading className="h6 mb-1">
                {invalidOffer ? 'Không tìm thấy gói tập' : 'Không tải được gói tập'}
              </Alert.Heading>
              <p className="mb-3">{errorMessage}</p>
              <div className="d-flex flex-wrap gap-2">
                {!invalidOffer ? (
                  <Button type="button" variant="outline-danger" size="sm" onClick={() => load()}>
                    Thử lại
                  </Button>
                ) : null}
                <Button as={Link} to="/offers" variant="outline-secondary" size="sm">
                  Về danh sách gói tập
                </Button>
              </div>
            </Alert>
          ) : offer ? (
            <Card className="border-0 shadow-sm mt-3">
              <Card.Body className="p-4 p-md-5">
                <Row className="g-4">
                  <Col md={7}>
                    <span className="badge bg-dark mb-2">{offer.planCode}</span>
                    <h1 className="fw-bold mb-2">{offer.name}</h1>
                    <p className="text-muted">{offer.description || '—'}</p>
                    <h2 className="h6 text-uppercase text-muted mt-4">
                      Quyền lợi
                    </h2>
                    {hasBenefitContract(offer) ? (
                      <MembershipBenefitList
                        benefitCodes={offer.benefitCodes}
                        benefits={offer.benefits}
                      />
                    ) : (
                      <ul className="mb-0">
                        {buildFeatures(offer).map((feature) => (
                          <li key={feature.code}>
                            {feature.ok ? '✓' : '–'} {feature.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="small text-muted mt-3 mb-0">
                      Thời hạn: {offer.durationDays} ngày
                    </p>
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
