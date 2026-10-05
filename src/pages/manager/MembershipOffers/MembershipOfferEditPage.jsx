// Manager – Edit membership offer (US08).
//
// Backend enforces the same validation rules as Create. We prefill from
// the list endpoint (MembershipOfferResponse is what we have available)
// and PATCH back the user-edited fields.
//
// MembershipOfferResponse does NOT include `status`, so when editing we
// default to ACTIVE on the form. Once the backend exposes status on the
// response, we should prefill from there instead.

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  listMembershipOffersAdmin,
  updateMembershipOffer,
} from '../../../services/membershipOfferAdminService';
import { formatPrice } from '../../../utils';

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

function offerToForm(o) {
  return {
    planCode: o.planCode || '',
    name: o.name || '',
    description: o.description || '',
    // priceAmount arrives as BigInteger-as-string from Spring; normalize.
    priceAmount:
      o.priceAmount == null
        ? ''
        : typeof o.priceAmount === 'string'
          ? o.priceAmount
          : String(o.priceAmount),
    durationDays:
      o.durationDays == null ? '' : String(o.durationDays),
    // Backend response doesn't include status. Default to ACTIVE so the
    // manager can intentionally flip it via the dropdown if needed.
    status: o.status || 'ACTIVE',
  };
}

export default function MembershipOfferEditPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listMembershipOffersAdmin();
      const found = list.find((o) => o.offerId === offerId);
      if (!found) {
        setLoadError(
          new Error(
            'Không tìm thấy gói tập này. Có thể đã bị xoá hoặc bạn không có quyền truy cập.',
          ),
        );
      } else {
        setForm(offerToForm(found));
      }
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    load();
  }, [load]);

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
      setSubmitError({ message: validationError });
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await updateMembershipOffer(offerId, {
        planCode: form.planCode,
        name: form.name.trim(),
        description: form.description.trim(),
        priceAmount: form.priceAmount,
        durationDays: Number(form.durationDays),
        status: form.status,
      });
      navigate(`/manager/membership-offers/${offerId}`, { replace: true });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="danger" />
      </div>
    );
  }

  if (loadError) {
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
          error={loadError}
          title="Không tải được gói tập"
        />
      </div>
    );
  }

  const previewPrice = /^\d+$/.test(String(form.priceAmount).trim())
    ? formatPrice(form.priceAmount, 'VND')
    : '—';

  return (
    <div>
      <Link
        to={`/manager/membership-offers/${offerId}`}
        className="small text-decoration-none"
      >
        ← Quay lại chi tiết
      </Link>

      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa gói tập</h1>
      <p className="text-muted mb-4">
        Cập nhật thông tin gói tập. Sau khi lưu, các hội viên đang dùng gói
        tập này vẫn giữ nguyên quyền lợi theo dữ liệu đã chốt.
      </p>

      <ErrorAlert
        error={submitError}
        title="Không cập nhật được gói tập"
        onClose={() => setSubmitError(null)}
      />

      <Form onSubmit={handleSubmit} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="edit-planCode">
              <Form.Label>Loại gói tập *</Form.Label>
              <Form.Select
                value={form.planCode}
                onChange={(e) => update('planCode', e.target.value)}
                required
              >
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-status">
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
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="edit-name">
          <Form.Label>Tên gói tập *</Form.Label>
          <Form.Control
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={200}
            required
          />
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả *</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            required
          />
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="edit-priceAmount">
              <Form.Label>Giá (VND) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                value={form.priceAmount}
                onChange={(e) => update('priceAmount', e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Xem trước: <strong>{previewPrice}</strong>
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-durationDays">
              <Form.Label>Thời hạn (ngày) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                value={form.durationDays}
                onChange={(e) => update('durationDays', e.target.value)}
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
                Đang lưu…
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => navigate(`/manager/membership-offers/${offerId}`)}
            disabled={submitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}