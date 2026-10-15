// Feedback của Coach dành cho Hội viên (US50 - Member View Feedback).
//
//   GET /api/v1/members/me/feedback   (MEMBER-only, BR-FDB-02)
//
// Phần tử trả về (MemberTrainingFeedbackResponse):
//   id, memberAccountId, coachAssignmentId, trainingPlanVersionId,
//   trainingResultId, classSessionId, content, createdByAccountId,
//   createdAt, updatedAt

import api from './api';

export async function listMyFeedback() {
  const { data } = await api.get('/members/me/feedback');
  return Array.isArray(data) ? data : [];
}
