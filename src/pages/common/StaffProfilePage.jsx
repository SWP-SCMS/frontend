import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { RhfDateInput } from '../../components/common/DateInput';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ProfileImageUploadControl from '../../components/common/ProfileImageUploadControl';
import AuthenticatedProfileImage from '../../components/common/AuthenticatedProfileImage';
import ErrorAlert from '../../components/common/ErrorAlert';
import { ROLE_LABELS, ROLES } from '../../constants';
import { useAuth } from '../../context/useAuth';
import { birthDateSchema, emailSchema, fullNameSchema, phoneCreateSchema, optionalPersonNameSchema } from '../../schemas/fragments';
import { getMyStaffProfile, updateMyStaffProfile, uploadMyStaffProfileImage, removeMyStaffProfileImage } from '../../services/staffProfileService';
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
  emergencyContactName: optionalPersonNameSchema,
  emergencyContactPhone: z.string().trim().refine((v) => !v || normalizePhone(v) != null, 'Số điện thoại không hợp lệ.').transform((v) => v ? normalizePhone(v) : ''),
  emergencyContactRelationship: z.string().trim().max(100, 'Mối quan hệ không được vượt quá 100 ký tự.'),
}).superRefine((data, ctx) => {
  if (Boolean(data.emergencyContactName) !== Boolean(data.emergencyContactPhone)) {
    ctx.addIssue({ code: 'custom', path: [data.emergencyContactName ? 'emergencyContactPhone' : 'emergencyContactName'], message: 'Vui lòng nhập cả tên và số điện thoại người liên hệ.' });
  }
});

function profileToForm(profile) {
  return {
    fullName: profile?.fullName || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    birthDate: profile?.birthDate || '',
    emergencyContactName: profile?.emergencyContactName || '',
    emergencyContactPhone: profile?.emergencyContactPhone || '',
    emergencyContactRelationship: profile?.emergencyContactRelationship || '',
  };
}

export default function StaffProfilePage() {
  const { setUser, role } = useAuth();
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [imageRevision, setImageRevision] = useState(0);
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
    for (const key of ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship']) {
      if (data[key] !== original?.[key]) patch[key] = data[key];
    }
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
      const handled = applyServerErrors(err, setError, { fields: ['fullName', 'phone', 'birthDate', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'] });
      if (!handled) setSaveError(err);
    }
  }

  function onImageUpdated(updated) {
    setProfile((current) => ({ ...current, profileImageUrl: updated.profileImageUrl }));
    setUser((current) => ({ ...current, profileImageUrl: updated.profileImageUrl }));
  }

  async function uploadImage(file) {
    setImageBusy(true);
    setImageError(null);
    try { return await uploadMyStaffProfileImage(file); }
    finally { setImageBusy(false); }
  }

  async function removeImage() {
    setImageBusy(true);
    setImageError(null);
    try {
      onImageUpdated(await removeMyStaffProfileImage());
      setImageRevision((value) => value + 1);
    } catch (error) { setImageError(error); }
    finally { setImageBusy(false); }
  }

  if (loading) return <div className="text-center py-5"><Spinner animation="border" variant="danger" /></div>;
  if (loadError || !profile) {
    return <div><h1 className="h3 fw-bold mb-3">Hồ sơ cá nhân</h1><ErrorAlert error={loadError} title="Không tải được hồ sơ cá nhân" /><Button type="button" variant="outline-danger" onClick={load}>Thử lại</Button></div>;
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><h1 className="h3 fw-bold mb-1">Hồ sơ cá nhân</h1></div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to={`${profilePath}/email`} variant="outline-danger">Đổi email</Button>
          <Button as={Link} to={`${profilePath}/password`} variant="outline-danger">Đổi mật khẩu</Button>
        </div>
      </div>
      <Row className="g-4 align-items-start">
      <Col lg={4}>
        <Card className="border-0 shadow-sm"><Card.Body className="p-4">
          <h2 className="h5 mb-3">Ảnh đại diện</h2>
          <div className="d-flex justify-content-center mb-3">
            <AuthenticatedProfileImage src={profile.profileImageUrl} alt={`Ảnh đại diện ${profile.fullName}`}
              width={160} height={160} className="rounded-3" style={{ objectFit: 'cover' }}
              fallback={<div className="rounded-3 bg-light d-flex align-items-center justify-content-center fs-1 text-secondary" style={{ width: 160, height: 160 }} aria-label="Chưa có ảnh đại diện">{profile.fullName?.trim().charAt(0)}</div>} />
          </div>
          <ErrorAlert error={imageError} title="Không xóa được ảnh" onClose={() => setImageError(null)} />
          <fieldset disabled={imageBusy || isSubmitting}>
            <ProfileImageUploadControl key={imageRevision} onUpload={uploadImage} onUploaded={onImageUpdated} />
            {profile.profileImageUrl && <Button type="button" variant="outline-secondary" size="sm" className="mt-2" onClick={removeImage}>Xóa ảnh</Button>}
          </fieldset>
        </Card.Body></Card>
      </Col>
      <Col lg={8}>
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <div className="mb-3"><h2 className="h5 mb-1">Thông tin nhân viên</h2><div className="small text-muted">{ROLE_LABELS[profile.role] || profile.role || '—'} · {STATUS_LABELS[profile.status] || profile.status || '—'}</div></div>
          <ErrorAlert error={saveError} title="Không lưu được hồ sơ" onClose={() => setSaveError(null)} />
          {saveNotice ? <Alert variant={saveNotice.startsWith('Không có') ? 'warning' : 'success'}>{saveNotice}</Alert> : null}
          <Form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Row className="g-3">
              <Col md={6}><Form.Group controlId="staff-profile-fullName"><Form.Label>Họ và tên *</Form.Label><Form.Control {...register('fullName')} maxLength={200} isInvalid={Boolean(errors.fullName)} /><Form.Control.Feedback type="invalid">{errors.fullName?.message}</Form.Control.Feedback></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-phone"><Form.Label>Số điện thoại *</Form.Label><Form.Control {...register('phone')} inputMode="numeric" isInvalid={Boolean(errors.phone)} /><Form.Control.Feedback type="invalid">{errors.phone?.message}</Form.Control.Feedback></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-email"><Form.Label>Email *</Form.Label><Form.Control type="email" {...register('email')} maxLength={320} readOnly /></Form.Group></Col>
              <Col md={6}><Form.Group controlId="staff-profile-birthDate"><Form.Label>Ngày sinh *</Form.Label><RhfDateInput control={control} name="birthDate" max={getGymZoneTodayIsoDate()} isInvalid={Boolean(errors.birthDate)} /><Form.Control.Feedback type="invalid">{errors.birthDate?.message}</Form.Control.Feedback></Form.Group></Col>
            </Row>
            <section className="border-top pt-4 mt-4" aria-labelledby="staff-emergency-heading">
              <h2 id="staff-emergency-heading" className="h5 mb-3">Liên hệ khẩn cấp</h2>
              <Row className="g-3">
                <Col md={6}><Form.Group controlId="staff-contact-name"><Form.Label>Tên người liên hệ</Form.Label><Form.Control {...register('emergencyContactName')} maxLength={200} isInvalid={Boolean(errors.emergencyContactName)} /><Form.Control.Feedback type="invalid">{errors.emergencyContactName?.message}</Form.Control.Feedback></Form.Group></Col>
                <Col md={6}><Form.Group controlId="staff-contact-phone"><Form.Label>Số điện thoại</Form.Label><Form.Control {...register('emergencyContactPhone')} type="tel" maxLength={32} isInvalid={Boolean(errors.emergencyContactPhone)} /><Form.Control.Feedback type="invalid">{errors.emergencyContactPhone?.message}</Form.Control.Feedback></Form.Group></Col>
                <Col md={6}><Form.Group controlId="staff-contact-relationship"><Form.Label>Mối quan hệ</Form.Label><Form.Control {...register('emergencyContactRelationship')} maxLength={100} isInvalid={Boolean(errors.emergencyContactRelationship)} /><Form.Control.Feedback type="invalid">{errors.emergencyContactRelationship?.message}</Form.Control.Feedback></Form.Group></Col>
              </Row>
            </section>
            <div className="d-flex gap-2 mt-4">
              <Button type="submit" variant="danger" disabled={isSubmitting || imageBusy}>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
              <Button type="button" variant="outline-secondary" disabled={isSubmitting || imageBusy} onClick={() => { reset(original); setSaveError(null); setSaveNotice(null); }}>Hủy thay đổi</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
      </Col>
      </Row>
    </div>
  );
}
