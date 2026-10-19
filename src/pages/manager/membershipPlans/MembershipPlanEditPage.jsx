import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../../components/common/ErrorAlert';
import { getMembershipPlan, listMembershipBenefits, updateMembershipPlan } from '../../../services/membershipPlanService';
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

export default function MembershipPlanEditPage() {
  const { planCode } = useParams();
  const navigate = useNavigate();
  const [original, setOriginal] = useState(null);
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [benefitsLocked, setBenefitsLocked] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(membershipPlanSchema),
    defaultValues: INITIAL_VALUES,
  });

  useEffect(() => {
    Promise.all([getMembershipPlan(planCode), listMembershipBenefits()])
      .then(([plan, catalog]) => {
        const form = { code: plan.code, displayName: plan.displayName, status: plan.status, benefitCodes: [...plan.benefitCodes] };
        reset(form); setOriginal(form); setBenefits(catalog);
      })
      .catch(setServerError)
      .finally(() => setLoading(false));
  }, [planCode, reset]);

  async function submit(data) {
    const patch = {};
    if (data.displayName.trim() !== original.displayName) patch.displayName = data.displayName.trim();
    if (data.status !== original.status) patch.status = data.status;
    const benefitChanged = [...data.benefitCodes].sort().join('|') !== [...original.benefitCodes].sort().join('|');
    if (benefitChanged && !benefitsLocked) patch.benefitCodes = data.benefitCodes;
    if (Object.keys(patch).length === 0) return navigate(`/manager/membership-plans/${planCode}`);
    setServerError(null);
    try {
      await updateMembershipPlan(planCode, patch);
      navigate(`/manager/membership-plans/${planCode}`, { replace: true });
    } catch (error) {
      if (planErrorCode(error) === 'MEMBERSHIP_PLAN_BENEFITS_LOCKED') {
        setBenefitsLocked(true);
        setValue('benefitCodes', [...original.benefitCodes], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      const handled = applyServerErrors(error, setError, {
        fields: ['code', 'displayName', 'status', 'benefitCodes'],
      });
      if (!handled) setServerError(error);
    }
  }

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (!original) return <ErrorAlert error={serverError} title="Không tải được loại gói" />;
  return (
    <div style={{ maxWidth: 820 }}>
      <Link to={`/manager/membership-plans/${planCode}`} className="small text-decoration-none">← Quay lại chi tiết</Link>
      <h1 className="h3 fw-bold mt-2 mb-1">Chỉnh sửa loại gói</h1>
      <p className="text-muted mb-4">Mã loại gói là bất biến. Backend sẽ khoá quyền lợi sau khi loại gói phát sinh đơn.</p>
      <ErrorAlert error={serverError} title={planErrorMessage(serverError) || 'Không cập nhật được loại gói'} onClose={() => setServerError(null)} />
      <MembershipPlanForm
        benefits={benefits}
        errors={errors}
        submitting={isSubmitting}
        codeReadOnly
        benefitsLocked={benefitsLocked}
        register={register}
        control={control}
        onSubmit={handleSubmit(submit)}
        onCancel={() => navigate(`/manager/membership-plans/${planCode}`)}
      />
    </div>
  );
}
