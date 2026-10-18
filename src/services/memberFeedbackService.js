// Feedback của Coach dành cho Hội viên (US50 - Member View Feedback).
//
//   GET /api/v1/members/me/feedback   (MEMBER-only, BR-FDB-02)
//
// Phần tử trả về (MemberTrainingFeedbackResponse):
//   id, memberAccountId, coachAssignmentId, trainingPlanVersionId,
//   trainingResultId, classSessionId, content, createdByAccountId,
//   createdAt, updatedAt

import api from './api';

export async function listMyFeedback({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/members/me/feedback', {
    params: { page, size },
  });
  if (!data || !Array.isArray(data.content)) {
    throw new TypeError('Invalid member feedback page response');
  }
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    page: Number.isInteger(data?.page) ? data.page : page,
    size: Number.isInteger(data?.size) ? data.size : size,
    totalElements: Number(data?.totalElements) || 0,
    totalPages: Number(data?.totalPages) || 0,
  };
}
