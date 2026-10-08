// Manager – Edit membership offer (US08).
//
// Backend enforces the same validation rules as Create. We prefill from
// the list endpoint (MembershipOfferResponse is what we have available)
// and PATCH back the user-edited fields.
//
// KNOWN ISSUE (out of scope for this migration):
//   MembershipOfferResponse does NOT include `status`, so when editing
//   we default to ACTIVE on the form. Once the backend exposes status
//   on the response, we should prefill from there instead. This
//   migration preserves the current effective behavior; the fix is
//   an API-contract change that is explicitly deferred.
//
// Migration note (RHF + Zod):
//   - separate page-local edit schema (membershipOfferEditSchema);
//     do not blindly reuse the create schema because the edit page
//     submits the full set of fields on save (per current build
//     behavior) and we want consistent validation.
//   - preserve async load via reset(...).
//   - preserve original values for any future PATCH-diff logic (we
//     currently send the full form payload, matching pre-migration
//     behavior).

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  listMembershipOffersAdmin,
  updateMembershipOffer,
} from '../../../services/membershipOfferAdminService';
import { applyServerErrors } from '../../../utils/serverErrors';
import { formatPrice } from '../../../utils';

const PLAN_OPTIONS = [
  { value: 'BASIC', label: 'BASIC' },
  { value: 'PLUS', label: 'PLUS' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

// Page-local edit schema — same field set as Create. The wire payload
// mirrors Create's (no diff vs original at the FE).
const membershipOfferEditSchema = z.object({
  planCode: z.enum(['BASIC', 'PLUS'], {
    message: 'Vui lòng chọn loại gói tập.',
  }),
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên gói tập.')
    .max(200, 'Tên gói tập không được vượt quá 200 ký tự.'),
  description: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mô tả gói tập.'),
  priceAmount: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập giá gói tập.')
    .regex(/^\d+$/, 'Giá gói tập phải là số nguyên dương (VND).')
    .refine(
      (s) => Number(s) > 0,
      'Giá gói tập phải lớn hơn 0.',
    ),
  durationDays: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập thời hạn gói tập.')
    .regex(/^\d+$/, 'Thời hạn gói tập phải là số nguyên dương.')
    .refine(
      (s) => Number(s) > 0,
      'Thời hạn gói tập phải lớn hơn 0 ngày.',
    ),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Vui lòng chọn trạng thái.',
  }),
});

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
    // This is the documented known issue (out of scope).
    status: o.status || 'ACTIVE',
  };
}

export default function MembershipOfferEditPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(membershipOfferEditSchema),
    defaultValues: {
      planCode: '',
      name: '',
      description: '',
      priceAmount: '',
      durationDays: '',
      status: 'ACTIVE',
    },
  });

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
        reset(offerToForm(found));
      }
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [offerId, reset]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(data) {
    setServerError(null);
    try {
      await updateMembershipOffer(offerId, {
        planCode: data.planCode,
        name: data.name.trim(),
        description: data.description.trim(),
        priceAmount: data.priceAmount,
        durationDays: Number(data.durationDays),
        status: data.status,
      });
      navigate(`/manager/membership-offers/${offerId}`, { replace: true });
    } catch (err) {
      // Shared helper: data.errors[field].
      // Allowlist MUST match the fields this page renders / registers.
      const handled = applyServerErrors(err, setError, {
        fields: [
          'planCode',
          'name',
          'description',
          'priceAmount',
          'durationDays',
          'status',
        ],
      });
      if (!handled) {
        setServerError(err);
      }
    }
  }

  // Live preview of the price using the same helper the detail page uses.
  // useWatch (not watch) is used here to avoid the
  // `react(incompatible-library)` lint warning that RHF's plain watch()
  // produces when its return value is passed to other components. Both
  // APIs subscribe to the same field; the value is identical for this
  // read-only preview use. The hook MUST run unconditionally (before
  // any early returns) so React's rules-of-hooks hold.
  const priceAmountValue = useWatch({ control, name: 'priceAmount' });
  const previewPrice = /^\d+$/.test(String(priceAmountValue || '').trim())
    ? formatPrice(priceAmountValue, 'VND')
    : '—';

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

  // Live preview computed above (before any early returns) so the
  // React hook order is stable across renders. The variables
  // `priceAmountValue` and `previewPrice` are referenced below.

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
        error={serverError}
        title="Không cập nhật được gói tập"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="edit-planCode">
              <Form.Label>Loại gói tập *</Form.Label>
              <Form.Select
                {...register('planCode')}
                isInvalid={Boolean(errors.planCode)}
              >
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.planCode?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-status">
              <Form.Label>Trạng thái *</Form.Label>
              <Form.Select
                {...register('status')}
                isInvalid={Boolean(errors.status)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.status?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="edit-name">
          <Form.Label>Tên gói tập *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={200}
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="edit-description">
          <Form.Label>Mô tả *</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
            isInvalid={Boolean(errors.description)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.description?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="edit-priceAmount">
              <Form.Label>Giá (VND) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                {...register('priceAmount')}
                isInvalid={Boolean(errors.priceAmount)}
              />
              <Form.Text className="text-muted">
                Xem trước: <strong>{previewPrice}</strong>
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.priceAmount?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="edit-durationDays">
              <Form.Label>Thời hạn (ngày) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                {...register('durationDays')}
                isInvalid={Boolean(errors.durationDays)}
              />
              <Form.Control.Feedback type="invalid">
                {errors.durationDays?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <div className="mt-4 d-flex gap-2">
          <Button type="submit" variant="danger" disabled={isSubmitting}>
            {isSubmitting ? (
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
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
