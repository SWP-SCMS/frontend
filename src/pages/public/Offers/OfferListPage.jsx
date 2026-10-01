// Public offer listing. Handoff §7:
//   GET /api/v1/membership-offers
//   - only ACTIVE offers
//   - optional planCode filter
//   - empty -> 200 []

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Col, Row, Spinner, ButtonGroup, Button } from 'react-bootstrap';
import PublicShell from '../../../components/layout/PublicShell';
import EmptyState from '../../../components/common/EmptyState';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { listActiveOffers } from '../../../services/membershipService';
import { formatPrice } from '../../../utils';
import { MEMBERSHIP_PLAN } from '../../../constants';

const PLAN_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: MEMBERSHIP_PLAN.BASIC, label: 'BASIC' },
  { value: MEMBERSHIP_PLAN.PLUS, label: 'PLUS' },
];

export default function OfferListPage() {
  const [params, setParams] = useSearchParams();
  const planCode = params.get('planCode') || '';

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listActiveOffers({ planCode: planCode || undefined })
      .then((data) => {
        if (cancelled) return;
        setOffers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (!status) {
          setOffers([]);
        } else {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [planCode]);

  function setPlan(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('planCode', value);
    else next.delete('planCode');
    setParams(next, { replace: true });
  }

  const hasError = !!error;

  const body = useMemo(() => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <Spinner animation="border" variant="danger" />
        </div>
      );
    }
    if (offers.length === 0) {
      return (
        <EmptyState
          title="Chưa có ưu đãi nào"
          message={
            planCode
              ? `Hiện không có gói ${planCode} nào đang mở bán.`
              : 'Hiện chưa có gói tập nào đang mở bán. Vui lòng quay lại sau.'
          }
        />
      );
    }
    return (
      <Row className="g-4">
        {offers.map((offer) => (
          <Col key={offer.offerId} md={6} lg={4}>
            <Card className="h-100 shadow-sm border-0">
              <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="badge bg-dark">{offer.planCode}</span>
                  <small className="text-muted">
                    {offer.durationDays} ngày
                  </small>
                </div>
                <Card.Title className="h5">{offer.name}</Card.Title>
                <Card.Text className="text-muted small flex-grow-1">
                  {offer.description || '—'}
                </Card.Text>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="h5 mb-0 text-danger fw-bold">
                    {formatPrice(offer.priceAmount, offer.currencyCode)}
                  </span>
                  <Button
                    as={Link}
                    to={`/offers/${offer.offerId}`}
                    variant="outline-danger"
                    size="sm"
                  >
                    Chi tiết
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    );
  }, [loading, offers, planCode]);

  return (
    <PublicShell>
      <section className="py-5">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4 flex-wrap gap-3">
            <div>
              <h1 className="fw-bold mb-1">Gói tập hiện có</h1>
              <p className="text-muted mb-0">
                Tất cả gói tập đang được mở bán tại trung tâm.
              </p>
            </div>
            <ButtonGroup>
              {PLAN_FILTERS.map((f) => (
                <Button
                  key={f.value || 'all'}
                  variant={
                    (planCode || '') === f.value
                      ? 'danger'
                      : 'outline-danger'
                  }
                  onClick={() => setPlan(f.value)}
                  size="sm"
                >
                  {f.label}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          {hasError ? (
            <ErrorAlert
              error={error}
              title="Không tải được danh sách ưu đãi"
              onClose={error?.response ? () => setError(null) : undefined}
            />
          ) : null}

          {body}
        </div>
      </section>
    </PublicShell>
  );
}
