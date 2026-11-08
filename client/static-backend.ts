// Stands in for the API server in the static build: the course comes from a
// data file, the compiler runs in a worker, and progress stays in this browser.
import type { Course, Exercise, Lesson, Module, Quiz } from '../server/content.ts';
import type { CheckInput } from '../shared/grader-core.ts';
import { gradeQuiz } from '../shared/quiz.ts';
import {
  SOLUTION_AFTER_ATTEMPTS,
  type ActivityState,
  type CheckResult,
  type CourseOverview,
  type GradebookResponse,
  type LessonDetail,
  type LessonRef,
  type LessonSummary,
  type SubmitExerciseResponse,
  type SubmitQuizResponse,
  type User,
} from '../shared/types.ts';

interface ActivityRef {
  moduleId: string;
  lessonId: string;
  activityId: string;
}

interface Stored {
  attempts: number;
  passed: boolean;
  draft: string | null;
  answers: number[][] | null;
}

const STORAGE_KEY = 'strict-mode:progress:v1';
const CHECK_TIMEOUT_MS = 10_000;

// ---- Progress ----

function loadProgress(): Record<string, Stored> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Stored>;
  } catch {
    return {};
  }
}

const progress = loadProgress();

function update(key: string, change: Partial<Stored>): Stored {
  const next = { attempts: 0, passed: false, draft: null, answers: null, ...progress[key], ...change };
  progress[key] = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private windows can refuse storage. Progress still lasts for this page load.
  }
  return next;
}

const keyOf = (ref: ActivityRef) => `${ref.moduleId}/${ref.lessonId}/${ref.activityId}`;
const stateOf = (stored: Stored | undefined): ActivityState => ({
  attempts: stored?.attempts ?? 0,
  passed: stored?.passed ?? false,
});

// ---- Course data ----

let coursePromise: Promise<Course> | null = null;

function loadStaticCourse(): Promise<Course> {
  coursePromise ??= fetch('/course.json').then((response) => {
    if (!response.ok) {
      coursePromise = null;
      throw new Error('The course couldn’t be loaded. Reload the page to try again.');
    }
    return response.json() as Promise<Course>;
  });
  return coursePromise;
}

const flatten = (course: Course) => course.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));

const refFor = (entry: { module: Module; lesson: Lesson } | undefined): LessonRef | null =>
  entry ? { moduleId: entry.module.id, lessonId: entry.lesson.id, title: entry.lesson.title } : null;

const summarize = (module: Module, lesson: Lesson): LessonSummary => ({
  id: lesson.id,
  title: lesson.title,
  minutes: lesson.minutes,
  activities: lesson.activities.length,
  passed: lesson.activities.filter((a) => progress[`${module.id}/${lesson.id}/${a.id}`]?.passed).length,
});

async function findActivity<T extends Quiz | Exercise>(ref: ActivityRef, kind: T['kind']): Promise<T> {
  const course = await loadStaticCourse();
  const activity = course.modules
    .find((m) => m.id === ref.moduleId)
    ?.lessons.find((l) => l.id === ref.lessonId)
    ?.activities.find((a) => a.id === ref.activityId);
  if (activity?.kind !== kind) throw new Error('Activity not found.');
  return activity as T;
}

// ---- Compiler worker ----

interface Job {
  id: number;
  input: CheckInput;
  resolve: (result: CheckResult) => void;
}

const abandoned = (message: string): CheckResult => ({
  passed: false,
  diagnostics: [],
  tests: [],
  setupError: message,
  timedOut: true,
});

let worker: Worker | null = null;
let ready = false;
let current: Job | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const queue: Job[] = [];

function finish(result: CheckResult) {
  if (timer) clearTimeout(timer);
  timer = null;
  current?.resolve(result);
  current = null;
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  ready = false;
}

function failEverything(message: string) {
  stopWorker();
  finish(abandoned(message));
  for (const job of queue.splice(0)) job.resolve(abandoned(message));
}

function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL('./check.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<{ type: 'ready' } | { type: 'failed' } | { type: 'result'; id: number; result: CheckResult }>) => {
    const data = event.data;
    if (data.type === 'failed') {
      failEverything('The TypeScript compiler couldn’t be loaded. Check your connection and try again.');
      return;
    }
    if (data.type === 'ready') ready = true;
    else if (current?.id === data.id) finish(data.result);
    pump();
  };
  worker.onerror = () => failEverything('The TypeScript compiler stopped unexpectedly. Try again.');
}

function pump() {
  ensureWorker();
  if (!ready || current) return;
  const job = queue.shift();
  if (!job) return;
  current = job;
  worker!.postMessage({ id: job.id, input: job.input });
  timer = setTimeout(() => {
    stopWorker();
    finish(abandoned('Type-checking took too long. Look for a very deep or recursive type.'));
    pump();
  }, CHECK_TIMEOUT_MS);
}

function runCheck(input: CheckInput): Promise<CheckResult> {
  return new Promise((resolve) => {
    queue.push({ id: nextId++, input, resolve });
    pump();
  });
}

const check = async (ref: ActivityRef, code: string) => {
  const exercise = await findActivity<Exercise>(ref, 'exercise');
  return runCheck({ code, check: exercise.check, support: exercise.support });
};

// ---- The same surface as the HTTP API ----

const localUser: User = { id: 1, name: 'You', email: '', role: 'learner' };
const unavailable = () => Promise.reject(new Error('Not available in this version.'));

export const staticApi = {
  me: async () => localUser,
  login: unavailable as (email: string, password: string) => Promise<User>,
  register: unavailable as (name: string, email: string, password: string) => Promise<User>,
  logout: async () => {},
  gradebook: unavailable as () => Promise<GradebookResponse>,

  course: async (): Promise<CourseOverview> => {
    const course = await loadStaticCourse();
    const modules = course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      source: module.source,
      lessons: module.lessons.map((lesson) => summarize(module, lesson)),
    }));
    const flat = modules.flatMap((module) => module.lessons);
    return {
      modules,
      totalActivities: flat.reduce((sum, lesson) => sum + lesson.activities, 0),
      passedActivities: flat.reduce((sum, lesson) => sum + lesson.passed, 0),
      next: refFor(
        flatten(course).find(({ module, lesson }) => {
          const summary = summarize(module, lesson);
          return summary.passed < summary.activities;
        }),
      ),
    };
  },

  lesson: async (moduleId: string, lessonId: string): Promise<LessonDetail> => {
    const entries = flatten(await loadStaticCourse());
    const index = entries.findIndex((e) => e.module.id === moduleId && e.lesson.id === lessonId);
    const entry = entries[index];
    if (!entry) throw new Error('Lesson not found.');
    const { module, lesson } = entry;
    return {
      moduleId,
      lessonId,
      moduleTitle: module.title,
      title: lesson.title,
      minutes: lesson.minutes,
      source: module.source,
      siblings: module.lessons.map((l) => summarize(module, l)),
      prev: refFor(entries[index - 1]),
      next: refFor(entries[index + 1]),
      blocks: lesson.blocks.map((block): LessonDetail['blocks'][number] => {
        if (block.kind === 'html') return { kind: 'html', html: block.html };
        const stored = progress[`${moduleId}/${lessonId}/${block.id}`];
        const state = stateOf(stored);
        if (block.kind === 'quiz') {
          return {
            kind: 'quiz',
            id: block.id,
            state,
            ...(state.passed && stored?.answers
              ? { review: { answers: stored.answers, result: gradeQuiz(block, stored.answers) } }
              : {}),
            questions: block.questions.map((q) => ({
              promptHtml: q.promptHtml,
              multi: q.choices.filter((c) => c.correct).length > 1,
              choices: q.choices.map((c) => ({ html: c.html })),
            })),
          };
        }
        return {
          kind: 'exercise',
          id: block.id,
          title: block.title,
          promptHtml: block.promptHtml,
          starter: block.starter,
          hints: block.hints,
          support: block.support,
          tests: block.check.split('\n').flatMap((line) => /\/\/\s*@test\s+(.+?)\s*$/.exec(line)?.[1] ?? []),
          state,
          draft: stored?.draft ?? null,
        };
      }),
    };
  },

  check,

  saveDraft: async (ref: ActivityRef, code: string) => {
    update(keyOf(ref), { draft: code });
  },

  submitCode: async (ref: ActivityRef, code: string): Promise<SubmitExerciseResponse> => {
    const result = await check(ref, code);
    const key = keyOf(ref);
    const previous = progress[key];
    const stored = result.timedOut
      ? update(key, { draft: code })
      : update(key, { draft: code, attempts: (previous?.attempts ?? 0) + 1, passed: Boolean(previous?.passed) || result.passed });
    return {
      result,
      state: stateOf(stored),
      solutionAvailable: stored.passed || stored.attempts >= SOLUTION_AFTER_ATTEMPTS,
    };
  },

  submitQuiz: async (ref: ActivityRef, answers: number[][]): Promise<SubmitQuizResponse> => {
    const quiz = await findActivity<Quiz>(ref, 'quiz');
    const result = gradeQuiz(quiz, answers);
    const key = keyOf(ref);
    const previous = progress[key];
    const passed = Boolean(previous?.passed) || result.passed;
    const stored = update(key, {
      attempts: (previous?.attempts ?? 0) + 1,
      passed,
      // Keep the answers that earned the pass, for the review on return visits.
      answers: result.passed || !previous?.passed ? answers : previous.answers,
    });
    return { result, state: stateOf(stored) };
  },

  solution: async (ref: ActivityRef): Promise<{ solution: string }> => {
    const exercise = await findActivity<Exercise>(ref, 'exercise');
    return { solution: exercise.solution };
  },
};
