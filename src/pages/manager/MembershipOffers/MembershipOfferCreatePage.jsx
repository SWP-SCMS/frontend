// Manager – Create membership offer (US08).
//
// Business rules (MembershipOfferAdminService#validate):
//   - planCode is REQUIRED on creation.
//   - name, description are required (non-empty after trim, name <= 200).
//   - priceAmount is required, must be > 0 (VND, integer).
//   - durationDays is required, must be > 0.
//   - status is optional; backend defaults to ACTIVE.
//
// On success we navigate to the detail page using the returned offerId.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import ErrorAlert from '../../../components/common/ErrorAlert';
import { createMembershipOffer } from '../../../services/membershipOfferAdminService';

const PLAN_OPTIONS = [
  { value: 'BASIC', label: 'BASIC' },
  { value: 'PLUS', label: 'PLUS' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

const emptyForm = {
  planCode: '',
  name: '',
  description: '',
  priceAmount: '',
  durationDays: '',
  status: 'ACTIVE',
};

export default function MembershipOfferCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.planCode) return 'Vui lòng chọn loại gói tập.';
    if (!PLAN_OPTIONS.some((o) => o.value === form.planCode)) {
      return 'Loại gói tập không hợp lệ.';
    }
    const name = form.name.trim();
    if (!name) return 'Vui lòng nhập tên gói tập.';
    if (name.length > 200) return 'Tên gói tập không được vượt quá 200 ký tự.';
    if (!form.description.trim()) return 'Vui lòng nhập mô tả gói tập.';

    const priceStr = String(form.priceAmount).trim();
    if (!priceStr) return 'Vui lòng nhập giá gói tập.';
    if (!/^\d+$/.test(priceStr)) {
      return 'Giá gói tập phải là số nguyên dương (VND).';
    }
    if (Number(form.priceAmount) <= 0) return 'Giá gói tập phải lớn hơn 0.';

    const daysStr = String(form.durationDays).trim();
    if (!daysStr) return 'Vui lòng nhập thời hạn gói tập.';
    if (!/^\d+$/.test(daysStr)) {
      return 'Thời hạn gói tập phải là số nguyên dương.';
    }
    if (Number(form.durationDays) <= 0) {
      return 'Thời hạn gói tập phải lớn hơn 0 ngày.';
    }

    if (!form.status) return 'Vui lòng chọn trạng thái.';
    if (!STATUS_OPTIONS.some((o) => o.value === form.status)) {
      return 'Trạng thái không hợp lệ.';
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError({ message: validationError });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await createMembershipOffer({
        planCode: form.planCode,
        name: form.name.trim(),
        description: form.description.trim(),
        priceAmount: form.priceAmount,
        durationDays: Number(form.durationDays),
        status: form.status,
      });
      navigate(
        `/manager/membership-offers/${created.offerId}`,
        { replace: true },
      );
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Link
        to="/manager/membership-offers"
        className="small text-decoration-none"
      >
        ← Quay lại danh sách
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Tạo gói tập mới</h1>
      <p className="text-muted mb-4">
        Mỗi gói tập thuộc một trong hai loại BASIC hoặc PLUS. Giá được tính
        bằng VND, không có phần thập phân.
      </p>

      <ErrorAlert
        error={error}
        title="Không tạo được gói tập"
        onClose={() => setError(null)}
      />

      <Form onSubmit={handleSubmit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="create-planCode">
              <Form.Label>Loại gói tập *</Form.Label>
              <Form.Select
                value={form.planCode}
                onChange={(e) => update('planCode', e.target.value)}
                required
              >
                <option value="">— Chọn loại —</option>
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="create-status">
              <Form.Label>Trạng thái *</Form.Label>
              <Form.Select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                required
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                ACTIVE sẽ hiển thị ngay cho hội viên; INACTIVE được giấu khỏi
                trang công khai.
              </Form.Text>
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="create-name">
          <Form.Label>Tên gói tập *</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={200}
            placeholder="VD: BASIC 1 tháng"
            required
          />
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả *</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Mô tả chi tiết quyền lợi của gói tập…"
            required
          />
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="create-priceAmount">
              <Form.Label>Giá (VND) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                value={form.priceAmount}
                onChange={(e) => update('priceAmount', e.target.value)}
                placeholder="VD: 500000"
                required
              />
              <Form.Text className="text-muted">
                Nhập số nguyên dương, không có phần thập phân (VND).
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="create-durationDays">
              <Form.Label>Thời hạn (ngày) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                value={form.durationDays}
                onChange={(e) => update('durationDays', e.target.value)}
                placeholder="VD: 30"
                required
              />
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tạo…
              </>
            ) : (
              'Tạo gói tập'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate('/manager/membership-offers')}
            disabled={submitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}