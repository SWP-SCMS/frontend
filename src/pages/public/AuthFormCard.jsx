// Shared visual shell for the Login / Register / ChangePassword forms.
// Keeps the marketing visual language consistent.

import { Card, Container } from 'react-bootstrap';

export default function AuthFormCard({ title, subtitle, children, footer }) {
  return (
    <section className="py-5 bg-body-tertiary min-vh-100 d-flex align-items-center">
      <Container className="scms-auth-wrap">
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4 p-md-5">
            <h1 className="h3 fw-bold mb-1">{title}</h1>
            {subtitle ? <p className="text-muted mb-4">{subtitle}</p> : null}
            {children}
          </Card.Body>
          {footer ? (
            <Card.Footer className="bg-white border-0 text-center pb-4">
              <small className="text-muted">{footer}</small>
            </Card.Footer>
          ) : null}
        </Card>
      </Container>
    </section>
  );
}
