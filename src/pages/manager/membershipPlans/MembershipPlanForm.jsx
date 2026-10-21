import { Button, Form, Spinner } from 'react-bootstrap';
import { useController } from 'react-hook-form';

import { benefitLabel, PLAN_STATUS_OPTIONS } from './membershipPlanUi';
import { groupMembershipBenefits } from '../../../utils/membershipBenefits';

export default function MembershipPlanForm({
  benefits,
  errors = {},
  submitting,
  codeReadOnly = false,
  benefitsLocked = false,
  register,
  control,
  onSubmit,
  onCancel,
}) {
  const { field: benefitCodesField } = useController({
    name: 'benefitCodes',
    control,
  });
  const selectedBenefitCodes = benefitCodesField.value || [];
  const benefitItems = groupMembershipBenefits({ benefits });

  function toggleBenefit(code) {
    benefitCodesField.onChange(
      selectedBenefitCodes.includes(code)
        ? selectedBenefitCodes.filter((item) => item !== code)
        : [...selectedBenefitCodes, code],
    );
  }

  return (
    <Form onSubmit={onSubmit} noValidate>
      <Form.Group className="mb-3" controlId="membership-plan-code">
        <Form.Label>Mã loại gói *</Form.Label>
        <Form.Control
          {...register('code', {
            setValueAs: (value) => String(value || '').toUpperCase(),
          })}
          readOnly={codeReadOnly}
          maxLength={50}
          placeholder="VD: PREMIUM"
          isInvalid={Boolean(errors.code)}
        />
        <Form.Text className="text-muted">
          Bắt đầu bằng chữ cái, chỉ gồm A–Z, 0–9 và dấu gạch dưới. Mã không
          thể đổi sau khi tạo.
        </Form.Text>
        <Form.Control.Feedback type="invalid">
          {errors.code?.message}
        </Form.Control.Feedback>
      </Form.Group>

      <Form.Group className="mb-3" controlId="membership-plan-name">
        <Form.Label>Tên hiển thị *</Form.Label>
        <Form.Control
          {...register('displayName')}
          maxLength={100}
          placeholder="VD: Gói Premium"
          isInvalid={Boolean(errors.displayName)}
        />
        <Form.Control.Feedback type="invalid">
          {errors.displayName?.message}
        </Form.Control.Feedback>
      </Form.Group>

      <Form.Group className="mb-3" controlId="membership-plan-status">
        <Form.Label>Trạng thái *</Form.Label>
        <Form.Select
          {...register('status')}
          isInvalid={Boolean(errors.status)}
        >
          {PLAN_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback type="invalid">
          {errors.status?.message}
        </Form.Control.Feedback>
      </Form.Group>

      <fieldset className="mb-3">
        <legend className="form-label fs-6">Quyền lợi *</legend>
        {benefitsLocked ? (
          <div className="alert alert-warning py-2" role="alert">
            Loại gói đã phát sinh đơn hàng nên quyền lợi không thể thay đổi.
            Bạn vẫn có thể sửa tên và trạng thái.
          </div>
        ) : null}
        <div className="border rounded p-3">
          {benefitItems.map((item) => (
            <div key={item.key} className={item.kind === 'group' ? 'mb-3' : ''}>
              {item.kind === 'group' ? (
                <div className="small text-uppercase text-muted fw-semibold mb-2">
                  {item.displayName}
                </div>
              ) : null}
              {item.benefits.map((benefit) => {
                const disabled = benefitsLocked || benefit.status !== 'ACTIVE';
                return (
                  <Form.Check
                    key={benefit.code}
                    className="mb-2"
                    id={`benefit-${benefit.code}`}
                    checked={selectedBenefitCodes.includes(benefit.code)}
                    disabled={disabled}
                    onChange={() => toggleBenefit(benefit.code)}
                    onBlur={benefitCodesField.onBlur}
                    label={<strong>{benefitLabel(benefit)}</strong>}
                  />
                );
              })}
            </div>
          ))}
          {benefits.length === 0 ? (
            <span className="text-muted">Chưa có quyền lợi khả dụng.</span>
          ) : null}
        </div>
        {errors.benefitCodes ? (
          <div className="invalid-feedback d-block">
            {errors.benefitCodes.message}
          </div>
        ) : null}
      </fieldset>

      <div className="d-flex gap-2">
        <Button type="submit" variant="danger" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Đang lưu…
            </>
          ) : (
            'Lưu loại gói'
          )}
        </Button>
        <Button
          type="button"
          variant="outline-secondary"
          disabled={submitting}
          onClick={onCancel}
        >
          Huỷ
        </Button>
      </div>
    </Form>
  );
}
