import type {
  CheckResult,
  CourseOverview,
  GradebookResponse,
  LessonDetail,
  SubmitExerciseResponse,
  SubmitQuizResponse,
  User,
} from '../shared/types.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error ?? 'Something went wrong.';
    throw new ApiError(response.status, message);
  }
  return data as T;
}

const activityUrl = (moduleId: string, lessonId: string, activityId: string) =>
  `/api/activities/${moduleId}/${lessonId}/${activityId}`;

export interface ActivityRef {
  moduleId: string;
  lessonId: string;
  activityId: string;
}

const urlFor = (ref: ActivityRef) => activityUrl(ref.moduleId, ref.lessonId, ref.activityId);

const httpApi = {
  me: () => request<User>('GET', '/api/me'),
  login: (email: string, password: string) => request<User>('POST', '/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    request<User>('POST', '/api/auth/register', { name, email, password }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  course: () => request<CourseOverview>('GET', '/api/course'),
  lesson: (moduleId: string, lessonId: string) => request<LessonDetail>('GET', `/api/lessons/${moduleId}/${lessonId}`),
  check: (ref: ActivityRef, code: string) => request<CheckResult>('POST', `${urlFor(ref)}/check`, { code }),
  saveDraft: (ref: ActivityRef, code: string) => request<void>('PUT', `${urlFor(ref)}/draft`, { code }),
  submitCode: (ref: ActivityRef, code: string) => request<SubmitExerciseResponse>('POST', `${urlFor(ref)}/submit`, { code }),
  submitQuiz: (ref: ActivityRef, answers: number[][]) =>
    request<SubmitQuizResponse>('POST', `${urlFor(ref)}/submit`, { answers }),
  solution: (ref: ActivityRef) => request<{ solution: string }>('GET', `${urlFor(ref)}/solution`),
  gradebook: () => request<GradebookResponse>('GET', '/api/instructor/gradebook'),
};

export const api: typeof httpApi = import.meta.env.VITE_STATIC
  ? (await import('./static-backend.ts')).staticApi
  : httpApi;
