// Pure helper functions for role checks. Kept separate from AuthContext
// so that Fast Refresh works for the React component file.

import { ROLES } from '../constants';

export function hasRole(user, role) {
  if (!user || !role) return false;
  if (Array.isArray(role)) return role.includes(user.role);
  return user.role === role;
}

export function isMember(user) {
  return hasRole(user, ROLES.MEMBER);
}

export function isReceptionist(user) {
  return hasRole(user, ROLES.RECEPTIONIST);
}

export function isCoach(user) {
  return hasRole(user, ROLES.COACH);
}

export function isManager(user) {
  return hasRole(user, ROLES.MANAGER);
}
