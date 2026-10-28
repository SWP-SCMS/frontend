import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { RhfDateInput } from '../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ErrorAlert from '../../components/common/ErrorAlert';
import { ROLE_LABELS, ROLES } from '../../constants';
import { useAuth } from '../../context/useAuth';
import { birthDateSchema, emailSchema, fullNameSchema, phoneCreateSchema } from '../../schemas/fragments';
import { getMyStaffProfile, updateMyStaffProfile } from '../../services/staffProfileService';
import { normalizePhone } from '../../utils';
import { getGymZoneTodayIsoDate } from '../../utils/gymTime';
import { applyServerErrors } from '../../utils/serverErrors';

const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động' };
const PROFILE_PATHS = {
  [ROLES.MANAGER]: '/manager/profile',
  [ROLES.RECEPTIONIST]: '/reception/profile',
  [ROLES.COACH]: '/coach/profile',
};

const profileSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneCreateSchema,
  email: emailSchema,
  birthDate: birthDateSchema,
});

function profileToForm(profile) {
  return {
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    birthDate: profile?.birthDate || '',
  };
}

export default function StaffProfilePage() {
  const { setUser, role } = useAuth();
  const [profile, setProfile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveNotice, setSaveNotice] = useState(null);
  const profilePath = PROFILE_PATHS[role] || '/';

  const { register, control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: profileToForm(null),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMyStaffProfile();
      const form = profileToForm(data);
      setProfile(data);
      setOriginal(form);
      reset(form);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => { load(); }, [load]);

  function buildPatch(data) {
    const patch = {};
    if (data.fullName !== original?.fullName) patch.fullName = data.fullName;
    if (data.phone !== normalizePhone(original?.phone)) patch.phone = data.phone;
    if (data.birthDate !== original?.birthDate) patch.birthDate = data.birthDate;
    return patch;
  }

  async function onSubmit(data) {
    setSaveError(null);
    setSaveNotice(null);
    const patch = buildPatch(data);
    if (Object.keys(patch).length === 0) {
      setSaveNotice('Không có thay đổi để lưu.');
      return;
    }
    try {
      const updated = await updateMyStaffProfile(patch);
      const form = profileToForm(updated);
      setProfile(updated);
      setOriginal(form);
      reset(form);
      setUser((current) => ({ ...current, ...updated }));
      setSaveNotice('Đã cập nhật hồ sơ cá nhân.');
    } catch (err) {
      const handled = applyServerErrors(err, setError, { fields: ['fullName', 'phone', 'birthDate'] });
      if (!handled) setSaveError(err);
    }
  }

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (loadError || !profile) {
    return <div><h1 className="h3 fw-bold mb-3">Hồ sơ cá nhân</h1><ErrorAlert error={loadError} title="Không tải được hồ sơ cá nhân" /><Button type="button" variant="outline-danger" onClick={load}>Thử lại</Button></div>;
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><h1 className="h3 fw-bold mb-1">Hồ sơ cá nhân</h1><p className="text-muted mb-0">Cập nhật thông tin liên hệ của tài khoản đang đăng nhập.</p></div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`${profilePath}/email`} variant="outline-danger">Đổi email</Button>
          <Button as={Link} to={`${profilePath}/password`} variant="outline-danger">Đổi mật khẩu</Button>
        </div>
      </div>
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <div className="mb-3"><h2 className="h5 mb-1">Thông tin nhân viên</h2><div className="small text-muted">{ROLE_LABELS[profile.role] || profile.role || '—'} · {STATUS_LABELS[profile.status] || profile.status || '—'}</div></div>
          <ErrorAlert error={saveError} title="Không lưu được hồ sơ" onClose={() => setSaveError(null)} />
          {saveNotice ? <Alert variant={saveNotice.startsWith('Không có') ? 'warning' : 'success'}>{saveNotice}</Alert> : null}
          <Form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Row className="g-3">
              <Col md={6}><Form.Group controlId="staff-profile-fullName"><Form.Label>Họ và tên *</Form.Label><Form.Control {...register('fullName')} maxLength={200} isInvalid={Boolean(errors.fullName)} /><Form.Control.Feedback type="invalid">{errors.fullName?.message}</Form.Control.Feedback></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-phone"><Form.Label>Số điện thoại *</Form.Label><Form.Control {...register('phone')} inputMode="numeric" isInvalid={Boolean(errors.phone)} /><Form.Text className="text-muted">Đây là thông tin dùng để đăng nhập và khôi phục mật khẩu. Hãy kiểm tra kỹ trước khi thay đổi.</Form.Text><Form.Control.Feedback type="invalid">{errors.phone?.message}</Form.Control.Feedback></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-email"><Form.Label>Email *</Form.Label><Form.Control type="email" {...register('email')} maxLength={320} readOnly /><Form.Text className="text-muted">Dùng nút “Đổi email” để xác thực địa chỉ mới.</Form.Text></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-birthDate"><Form.Label>Ngày sinh *</Form.Label><RhfDateInput control={control} name="birthDate" max={getGymZoneTodayIsoDate()} isInvalid={Boolean(errors.birthDate)} /><Form.Control.Feedback type="invalid">{errors.birthDate?.message}</Form.Control.Feedback></Form.Group></Col>
            </Row>
            <div className="d-flex gap-2 mt-4">
              <Button type="submit" variant="danger" disabled={isSubmitting}>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
              <Button type="button" variant="outline-secondary" disabled={isSubmitting} onClick={() => { reset(original); setSaveError(null); setSaveNotice(null); }}>Hủy thay đổi</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
