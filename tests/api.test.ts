import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, test } from 'node:test';
import type { CourseOverview, GradebookResponse, LessonDetail, PublicExercise, PublicQuiz, SubmitExerciseResponse, SubmitQuizResponse } from '../shared/types.ts';
import { createApp } from '../server/app.ts';
import { Checker } from '../server/checker.ts';
import { loadCourse, type Course, type Exercise, type Quiz } from '../server/content.ts';
import { openDb } from '../server/db.ts';

let server: Server;
let base: string;
let checker: Checker;
let course: Course;

before(async () => {
  course = await loadCourse(path.resolve(import.meta.dirname, '../content'));
  checker = new Checker();
  const { app, errorHandler } = createApp({ db: openDb(':memory:'), course, checker });
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await checker.close();
  server.close();
});

class Client {
  cookie = '';
  async call<T>(method: string, url: string, body?: unknown): Promise<{ status: number; data: T }> {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: this.cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0] ?? '';
    const text = await response.text();
    return { status: response.status, data: (text ? JSON.parse(text) : null) as T };
  }
  register(name: string, email: string) {
    return this.call<{ role: string }>('POST', '/api/auth/register', { name, email, password: 'correct-horse' });
  }
}

const instructor = new Client();
const learner = new Client();
const exerciseUrl = '/api/activities/basics/strictness/fix-implicit-any';
const quizUrl = '/api/activities/basics/static-checking/check';

function sourceExercise(): Exercise {
  return course.modules[0]!.lessons.find((l) => l.id === 'strictness')!.activities.find((a) => a.kind === 'exercise') as Exercise;
}
function sourceQuiz(): Quiz {
  return course.modules[0]!.lessons.find((l) => l.id === 'static-checking')!.activities[0] as Quiz;
}

test('the first account is the instructor and later ones are learners', async () => {
  assert.equal((await instructor.register('Ina', 'ina@example.com')).data.role, 'instructor');
  assert.equal((await learner.register('Lee', 'lee@example.com')).data.role, 'learner');
});

test('duplicate emails are rejected regardless of case', async () => {
  const { status } = await new Client().register('Dup', 'LEE@example.com');
  assert.equal(status, 409);
});

test('wrong passwords are rejected', async () => {
  const { status } = await new Client().call('POST', '/api/auth/login', { email: 'lee@example.com', password: 'nope-nope' });
  assert.equal(status, 401);
});

test('the API requires a session', async () => {
  assert.equal((await new Client().call('GET', '/api/course')).status, 401);
});

test('learners cannot see the gradebook', async () => {
  assert.equal((await learner.call('GET', '/api/instructor/gradebook')).status, 403);
});

test('lesson payloads do not leak answers, solutions or hidden tests', async () => {
  const { data } = await learner.call<LessonDetail>('GET', '/api/lessons/basics/strictness');
  const raw = JSON.stringify(data);
  assert.ok(!raw.includes('"correct"'));
  assert.ok(!raw.includes('"correctChoices"'));
  assert.ok(!raw.includes('"whyHtml"'));
  assert.ok(!raw.includes('_welcomeParams'));
  assert.ok(!raw.includes(sourceExercise().solution.trim()));
  const exercise = data.blocks.find((b) => b.kind === 'exercise') as PublicExercise;
  assert.equal(exercise.tests.length, 2);
});

test('live checks do not count as attempts', async () => {
  await learner.call('POST', `${exerciseUrl}/check`, { code: sourceExercise().starter });
  const { data } = await learner.call<LessonDetail>('GET', '/api/lessons/basics/strictness');
  const exercise = data.blocks.find((b) => b.kind === 'exercise') as PublicExercise;
  assert.equal(exercise.state.attempts, 0);
});

test('the solution stays locked until two submissions', async () => {
  assert.equal((await learner.call('GET', `${exerciseUrl}/solution`)).status, 403);
  const first = await learner.call<SubmitExerciseResponse>('POST', `${exerciseUrl}/submit`, { code: sourceExercise().starter });
  assert.equal(first.data.result.passed, false);
  assert.equal(first.data.solutionAvailable, false);
  const second = await learner.call<SubmitExerciseResponse>('POST', `${exerciseUrl}/submit`, { code: sourceExercise().starter });
  assert.equal(second.data.solutionAvailable, true);
  const { data } = await learner.call<{ solution: string }>('GET', `${exerciseUrl}/solution`);
  assert.equal(data.solution, sourceExercise().solution);
});

test('a correct exercise submission passes and is remembered', async () => {
  const { data } = await learner.call<SubmitExerciseResponse>('POST', `${exerciseUrl}/submit`, { code: sourceExercise().solution });
  assert.equal(data.result.passed, true);
  assert.equal(data.state.passed, true);
  // Failing later doesn't undo a pass.
  const after = await learner.call<SubmitExerciseResponse>('POST', `${exerciseUrl}/submit`, { code: 'broken(' });
  assert.equal(after.data.state.passed, true);
});

test('quizzes are graded on the server and keep the first-try score', async () => {
  const quiz = sourceQuiz();
  const right = quiz.questions.map((q) => q.choices.flatMap((c, i) => (c.correct ? [i] : [])));
  const wrong = right.map((a, i) => (i === 0 ? [(a[0]! + 1) % quiz.questions[0]!.choices.length] : a));

  const failed = await learner.call<SubmitQuizResponse>('POST', `${quizUrl}/submit`, { answers: wrong });
  assert.equal(failed.data.result.passed, false);
  assert.equal(failed.data.result.score, 0.5);

  const passed = await learner.call<SubmitQuizResponse>('POST', `${quizUrl}/submit`, { answers: right });
  assert.equal(passed.data.result.passed, true);

  const { data } = await learner.call<LessonDetail>('GET', '/api/lessons/basics/static-checking');
  const block = data.blocks.find((b) => b.kind === 'quiz') as PublicQuiz;
  assert.equal(block.state.attempts, 2);
  assert.deepEqual(block.review?.answers, right);
});

test('malformed quiz answers are rejected', async () => {
  assert.equal((await learner.call('POST', `${quizUrl}/submit`, { answers: 'x' })).status, 400);
  assert.equal((await learner.call('POST', `${quizUrl}/submit`, { answers: [[0]] })).status, 400);
});

test('course progress and the next lesson reflect completed work', async () => {
  const { data } = await learner.call<CourseOverview>('GET', '/api/course');
  assert.equal(data.passedActivities, 2);
  assert.equal(data.next?.lessonId, 'tsc');
});

test('the gradebook reports progress and first-try scores', async () => {
  const { status, data } = await instructor.call<GradebookResponse>('GET', '/api/instructor/gradebook');
  assert.equal(status, 200);
  const row = data.rows.find((r) => r.email === 'lee@example.com');
  assert.ok(row);
  assert.ok(row.overall > 0);
  assert.ok((row.modules[0] ?? 0) > 0);
  assert.notEqual(row.firstTryAverage, null);
  assert.ok(data.hardest.some((item) => item.activityId === 'basics/strictness/fix-implicit-any'));
});

test('a type-checker bomb is stopped without taking down the server', { timeout: 60_000 }, async () => {
  const bomb = `
type T0<A> = [A, A, A, A, A, A, A, A];
type Big = T0<T0<T0<T0<T0<T0<T0<T0<T0<T0<string>>>>>>>>>>;
type D<T> = T extends any[] ? { [K in keyof T]: D<T[K]> } : T;
declare const big: D<Big>;
const other: D<T0<T0<T0<T0<T0<T0<T0<T0<T0<T0<number>>>>>>>>>> = big;
`;
  const { status } = await learner.call('POST', `${exerciseUrl}/check`, { code: bomb });
  assert.equal(status, 200);
  const { data } = await learner.call<{ passed: boolean }>('POST', `${exerciseUrl}/check`, { code: sourceExercise().solution });
  assert.equal(data.passed, true);
});

test('oversized code is rejected', async () => {
  const { status } = await learner.call('POST', `${exerciseUrl}/check`, { code: 'x'.repeat(30_000) });
  assert.equal(status, 400);
});

test('logging out ends the session', async () => {
  const client = new Client();
  await client.register('Temp', 'temp@example.com');
  const stale = client.cookie;
  await client.call('POST', '/api/auth/logout');
  client.cookie = stale;
  assert.equal((await client.call('GET', '/api/me')).status, 401);
});
