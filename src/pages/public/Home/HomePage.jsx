// Public homepage.
// Sections in order:
//   - Hero
//   - BASIC / PLUS plan overview
//   - Features
//   - CTA
//
// The "active Membership Offers" block used to live here but was
// removed while we rebuild the marketing homepage. Offer browsing
// remains available at /offers.

import { Link } from 'react-router-dom';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import PublicShell from '../../../components/layout/PublicShell';
import {
  HOMEPAGE_COPY,
  PLAN_OVERVIEW,
  FEATURES,
} from '../../../content/home';

export default function HomePage() {
  return (
    <PublicShell>
      {/* Hero */}
      <section className="py-5 scms-hero">
        <Container className="py-4">
          <Row className="align-items-center g-4">
            <Col md={7}>
              <p className="text-uppercase fw-semibold text-danger bg-white d-inline-block px-2 py-1 rounded mb-3 scms-hero-eyebrow">
                SWP GYM · Sports Center Management
              </p>
              <h1 className="display-4 fw-bold mb-3">
                Quản lý phòng tập <span className="scms-hero-accent">hiện đại</span>
                <br />
                cho hội viên và đội ngũ vận hành.
              </h1>
              <p className="lead text-white-50 mb-4">
                SCMS giúp bạn đăng ký gói tập, đặt lịch PT, điểm danh lớp
                học và theo dõi tiến trình — tất cả trong một hệ thống duy
                nhất.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Button as={Link} to="/register" variant="danger" size="lg">
                  {HOMEPAGE_COPY.heroPrimary}
                </Button>
                <Button as={Link} to="/offers" variant="outline-light" size="lg">
                  {HOMEPAGE_COPY.heroSecondary}
                </Button>
              </div>
            </Col>
            <Col md={5} className="d-none d-md-block text-center">
              <div className="rounded-4 p-4 mx-auto scms-hero-card">
                <p className="text-white-50 small mb-2">Vận hành bởi</p>
                <h3 className="fw-bold mb-0">SWP GYM</h3>
                <p className="mb-0 small text-white-50">FPT University · SWP391</p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Plan overview */}
      <section className="py-5 bg-white">
        <Container>
          <div className="text-center mb-4">
            <h2 className="fw-bold mb-2">{HOMEPAGE_COPY.planOverviewTitle}</h2>
            <p className="text-muted mb-0">{HOMEPAGE_COPY.planOverviewSubtitle}</p>
          </div>
          <Row className="g-4">
            {PLAN_OVERVIEW.map((plan) => (
              <Col key={plan.code} md={6}>
                <Card
                  className={`h-100 border-0 shadow-sm ${
                    plan.highlight ? 'border-danger scms-plan-highlight' : ''
                  }`}
                >
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-baseline">
                      <Card.Title className="fw-bold mb-0">{plan.title}</Card.Title>
                      {plan.highlight ? (
                        <span className="badge bg-danger">Phổ biến</span>
                      ) : null}
                    </div>
                    <p className="text-muted">{plan.tagline}</p>
                    <ul className="mb-0">
                      {plan.bullets.map((b) => (
                        <li key={b} className="mb-1">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Features */}
      <section className="py-5 bg-white">
        <Container>
          <Row className="g-4 text-center">
            {FEATURES.map((f) => (
              <Col key={f.title} md={6} lg={3}>
                <div className="p-3">
                  <h5 className="fw-semibold mb-2">{f.title}</h5>
                  <p className="text-muted small mb-0">{f.desc}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-5 text-white text-center scms-cta-band">
        <Container>
          <h2 className="fw-bold mb-2">{HOMEPAGE_COPY.ctaTitle}</h2>
          <p className="text-white-50 mb-4">{HOMEPAGE_COPY.ctaSubtitle}</p>
          <Button as={Link} to="/register" variant="danger" size="lg">
            {HOMEPAGE_COPY.ctaPrimary}
          </Button>
        </Container>
      </section>
    </PublicShell>
  );
}
