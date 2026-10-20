import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Form, Spinner } from 'react-bootstrap';
import { useController } from 'react-hook-form';

import { listMembershipBenefits } from '../../../services/membershipPlanService';
import {
  formatBenefitCode,
  normalizeBenefitCodes,
} from '../../../utils/membershipBenefits';

const BASE_BENEFIT_CODE = 'CLASS_BOOKING';

export default function DisciplineBenefitField({ control, error }) {
  const { field } = useController({
    name: 'requiredBenefitCodes',
    control,
  });
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCatalog(await listMembershipBenefits());
    } catch (nextError) {
      setLoadError(nextError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCodes = useMemo(
    () => normalizeBenefitCodes(field.value).filter((code) => code !== BASE_BENEFIT_CODE),
    [field.value],
  );
  const options = useMemo(() => {
    const byCode = new Map();
    for (const benefit of catalog) {
      if (!benefit?.code || benefit.code === BASE_BENEFIT_CODE) continue;
      byCode.set(benefit.code, benefit);
    }
    for (const code of selectedCodes) {
      if (!byCode.has(code)) byCode.set(code, { code, status: 'INACTIVE' });
    }
    return [...byCode.values()].sort((left, right) =>
      (left.displayName || formatBenefitCode(left.code)).localeCompare(
        right.displayName || formatBenefitCode(right.code),
        'vi',
      ),
    );
  }, [catalog, selectedCodes]);

  function toggle(code) {
    field.onChange(
      selectedCodes.includes(code)
        ? selectedCodes.filter((item) => item !== code)
        : [...selectedCodes, code],
    );
  }

  return (
    <fieldset className="mt-3">
      <legend className="form-label fs-6 mb-1">Quyền lợi bắt buộc</legend>
      <Form.Text className="text-muted d-block mb-2">
        Hội viên phải có đủ các quyền lợi đã chọn mới đặt được lớp thuộc bộ môn này.
      </Form.Text>
      <div className="border rounded p-3">
        <Form.Check
          id="discipline-benefit-class-booking"
          className="mb-2"
          checked
          disabled
          readOnly
          label={
            <span>
              <strong>{formatBenefitCode(BASE_BENEFIT_CODE)}</strong>
              <Badge bg="secondary" className="ms-2">Luôn bắt buộc</Badge>
            </span>
          }
        />

        {loading ? (
          <div className="small text-muted d-flex align-items-center gap-2 py-2">
            <Spinner animation="border" size="sm" />
            Đang tải danh mục quyền lợi…
          </div>
        ) : null}

        {!loading && loadError ? (
          <Alert variant="warning" className="py-2 mb-2">
            Không tải được danh mục quyền lợi.{' '}
            <Alert.Link as="button" type="button" onClick={load}>
              Thử lại
            </Alert.Link>
          </Alert>
        ) : null}

        {!loading && !loadError
          ? options.map((benefit) => {
              const checked = selectedCodes.includes(benefit.code);
              const inactive = benefit.status === 'INACTIVE';
              return (
                <Form.Check
                  key={benefit.code}
                  id={`discipline-benefit-${benefit.code}`}
                  className="mb-2"
                  checked={checked}
                  disabled={inactive && !checked}
                  onBlur={field.onBlur}
                  onChange={() => toggle(benefit.code)}
                  label={
                    <span>
                      <strong>{benefit.displayName || formatBenefitCode(benefit.code)}</strong>
                      {inactive ? (
                        <Badge bg="secondary" className="ms-2">Ngừng áp dụng</Badge>
                      ) : null}
                    </span>
                  }
                />
              );
            })
          : null}
      </div>
      {error ? <div className="invalid-feedback d-block">{error.message}</div> : null}
    </fieldset>
  );
}
