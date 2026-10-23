import api from './api';

// Shared by MANAGER, RECEPTIONIST and COACH.
export async function getMyStaffProfile() {
  const { data } = await api.get('/staff/me/profile');
  return data;
}

// Backend rejects unknown keys. Callers must build this object from the
// editable whitelist: fullName, phone and birthDate.
export async function updateMyStaffProfile(patch) {
  const { data } = await api.patch('/staff/me/profile', patch);
  return data;
}
