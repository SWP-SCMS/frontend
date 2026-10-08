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
//
// Migration note (RHF + Zod):
//   - page-local schema. No shared fragments used; no MembershipOffer-
//     specific business codes currently verified in the codebase, so
//     the shared serverErrors helper handles only data.errors[field]
//     and the EMAIL/PHONE uniqueness codes (which do not apply here).
//   - Numeric conversion (`durationDays: Number(form.durationDays)`)
//     is preserved exactly at payload assembly.
//   - priceAmount is sent as a string (BigInteger-as-string), matching
//     the pre-migration source.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { createMembershipOffer } from '../../../services/membershipOfferAdminService';
import { applyServerErrors } from '../../../utils/serverErrors';

const PLAN_OPTIONS = [
  { value: 'BASIC', label: 'BASIC' },
  { value: 'PLUS', label: 'PLUS' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
];

// Page-local schema.
const membershipOfferCreateSchema = z.object({
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

export default function MembershipOfferCreatePage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(membershipOfferCreateSchema),
    defaultValues: {
      planCode: '',
      name: '',
      description: '',
      priceAmount: '',
      durationDays: '',
      status: 'ACTIVE',
    },
  });

  async function onSubmit(data) {
    setServerError(null);
    try {
      const created = await createMembershipOffer({
        planCode: data.planCode,
        name: data.name.trim(),
        description: data.description.trim(),
        priceAmount: data.priceAmount,
        durationDays: Number(data.durationDays),
        status: data.status,
      });
      navigate(
        `/manager/membership-offers/${created.offerId}`,
        { replace: true },
      );
    } catch (err) {
      // Shared helper: data.errors[field]. No MembershipOffer-specific
      // business codes are currently verified in the source; the global
      // ErrorAlert remains the catch-all for unknown errors.
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
        error={serverError}
        title="Không tạo được gói tập"
        onClose={() => setServerError(null)}
      />

      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group controlId="create-planCode">
              <Form.Label>Loại gói tập *</Form.Label>
              <Form.Select
                {...register('planCode')}
                isInvalid={Boolean(errors.planCode)}
              >
                <option value="">— Chọn loại —</option>
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
            <Form.Group controlId="create-status">
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
              <Form.Text className="text-muted">
                ACTIVE sẽ hiển thị ngay cho hội viên; INACTIVE được giấu khỏi
                trang công khai.
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.status?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mt-3" controlId="create-name">
          <Form.Label>Tên gói tập *</Form.Label>
          <Form.Control
            {...register('name')}
            maxLength={200}
            placeholder="VD: BASIC 1 tháng"
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.name?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mt-3" controlId="create-description">
          <Form.Label>Mô tả *</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            {...register('description')}
            placeholder="Mô tả chi tiết quyền lợi của gói tập…"
            isInvalid={Boolean(errors.description)}
          />
          <Form.Control.Feedback type="invalid">
            {errors.description?.message}
          </Form.Control.Feedback>
        </Form.Group>

        <Row className="g-3 mt-1">
          <Col md={6}>
            <Form.Group controlId="create-priceAmount">
              <Form.Label>Giá (VND) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                {...register('priceAmount')}
                placeholder="VD: 500000"
                isInvalid={Boolean(errors.priceAmount)}
              />
              <Form.Text className="text-muted">
                Nhập số nguyên dương, không có phần thập phân (VND).
              </Form.Text>
              <Form.Control.Feedback type="invalid">
                {errors.priceAmount?.message}
              </Form.Control.Feedback>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group controlId="create-durationDays">
              <Form.Label>Thời hạn (ngày) *</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                {...register('durationDays')}
                placeholder="VD: 30"
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
            disabled={isSubmitting}
          >
            Huỷ
          </Button>
        </div>
      </Form>
    </div>
  );
}
