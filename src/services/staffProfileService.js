import api from './api';

// Shared by MANAGER, RECEPTIONIST and COACH.
export async function getMyStaffProfile() {
  const { data } = await api.get('/staff/me/profile');
  return data;
}

// Backend rejects unknown keys. Callers must build this object from the
// editable whitelist: personal details and emergency contact fields.
export async function updateMyStaffProfile(patch) {
  const { data } = await api.patch('/staff/me/profile', patch);
  return data;
}

export async function uploadMyStaffProfileImage(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/staff/me/profile/image', body);
  return data;
}

export async function removeMyStaffProfileImage() {
  const { data } = await api.delete('/staff/me/profile/image');
  return data;
}
