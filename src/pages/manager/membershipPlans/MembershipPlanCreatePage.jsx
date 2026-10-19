import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import {
  createMembershipPlan,
  listMembershipBenefits,
} from '../../../services/membershipPlanService';
import MembershipPlanForm from './MembershipPlanForm';
import { planErrorCode, planErrorMessage } from './membershipPlanUi';
import { membershipPlanSchema } from './membershipPlanSchema';
import { applyServerErrors } from '../../../utils/serverErrors';

const INITIAL_VALUES = {
  code: '',
  displayName: '',
  status: 'ACTIVE',
  benefitCodes: [],
};

export default function MembershipPlanCreatePage() {
  const navigate = useNavigate();
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: INITIAL_VALUES,
  });

  useEffect(() => {
    listMembershipBenefits()
      .then(setBenefits)
      .catch(setServerError)
      .finally(() => setLoading(false));
  }, []);

  async function submit(data) {
    setServerError(null);
    try {
      const created = await createMembershipPlan({
        ...data,
        code: data.code.trim(),
        displayName: data.displayName.trim(),
      });
      navigate(`/manager/membership-plans/${created.code}`, { replace: true });
    } catch (error) {
      if (planErrorCode(error) === 'MEMBERSHIP_PLAN_CODE_CONFLICT') {
        setError('code', { type: 'server', message: planErrorMessage(error) });
      } else {
        const handled = applyServerErrors(error, setError, {
          fields: ['code', 'displayName', 'status', 'benefitCodes'],
        });
        if (!handled) setServerError(error);
      }
    }
  }

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <Link to="/manager/membership-plans" className="small text-decoration-none">
        ← Quay lại danh sách
      </Link>
      <h1 className="h3 fw-bold mt-2 mb-1">Tạo loại gói tập</h1>
      <p className="text-muted mb-4">
        Loại gói xác định tập quyền lợi; giá bán và thời hạn được cấu hình ở gói bán.
      </p>
      <ErrorAlert
        error={serverError}
        title={planErrorMessage(serverError) || 'Không tạo được loại gói'}
        onClose={() => setServerError(null)}
      />
      <MembershipPlanForm
        benefits={benefits}
        errors={errors}
        submitting={isSubmitting}
        register={register}
        control={control}
        onSubmit={handleSubmit(submit)}
        onCancel={() => navigate('/manager/membership-plans')}
      />
    </div>
  );
}
