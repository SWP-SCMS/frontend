import axios from 'axios';
import { API_BASE_URL } from '../constants';
import { normalizeCoursePage } from './courseServiceUtils';

// Catalog Course là API công khai. Không dùng axios có bearer token để một
// token cũ/hết hạn không biến request công khai thành lỗi 401.
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

export async function listCatalogCourses({ page = 0, size = 20 } = {}) {
  const { data } = await publicApi.get('/courses', { params: { page, size } });
  return normalizeCoursePage(data);
}

export async function getCatalogCourse(courseId) {
  const { data } = await publicApi.get(`/courses/${courseId}`);
  return data;
}

export async function listCatalogCourseRuns({ page = 0, size = 20 } = {}) {
  const { data } = await publicApi.get('/course-runs', {
    params: { page, size },
  });
  return normalizeCoursePage(data);
}

export async function listAllCatalogCourseRuns() {
  const runs = [];
  for (let page = 0; ; page++) {
    const result = await listCatalogCourseRuns({ page, size: 100 });
    runs.push(...result.content);
    if (result.last) return runs;
  }
}

export async function getCatalogCourseRun(runId) {
  const { data } = await publicApi.get(`/course-runs/${runId}`);
  return data;
}
