import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { gradeQuiz } from '../shared/quiz.ts';
import {
  SOLUTION_AFTER_ATTEMPTS,
  type ActivityState,
  type CourseOverview,
  type GradebookResponse,
  type GradebookRow,
  type ItemStat,
  type LessonDetail,
  type LessonRef,
  type LessonSummary,
  type Role,
  type SubmitExerciseResponse,
  type SubmitQuizResponse,
  type User,
} from '../shared/types.ts';
import {
  createSession,
  destroySession,
  DUMMY_HASH,
  hashPassword,
  readCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  userForToken,
  verifyPassword,
} from './auth.ts';
import { QueueFullError, type Checker } from './checker.ts';
import { activityKey, type Activity, type Course, type Exercise, type Lesson, type Module, type Quiz } from './content.ts';
import type { Db } from './db.ts';

const MAX_CODE_LENGTH = 20_000;

interface StateRow {
  activity_id: string;
  attempts: number;
  first_score: number | null;
  best_score: number | null;
  passed_at: string | null;
  draft: string | null;
}

interface AuthedRequest extends Request {
  user: User;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function rateLimit(limit: number, key: (req: Request) => string): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const id = key(req);
    let entry = hits.get(id);
    if (!entry || entry.resetAt < now) {
      if (hits.size > 10_000) hits.clear();
      entry = { count: 0, resetAt: now + 60_000 };
      hits.set(id, entry);
    }
    if (++entry.count > limit) return next(new HttpError(429, 'Too many requests. Wait a minute and try again.'));
    next();
  };
}

function parseAnswers(value: unknown, quiz: Quiz): number[][] {
  if (
    !Array.isArray(value) ||
    value.length !== quiz.questions.length ||
    !value.every((a) => Array.isArray(a) && a.every((n) => Number.isInteger(n)))
  ) {
    throw new HttpError(400, 'Answer every question before submitting.');
  }
  return value as number[][];
}

export function createApp({ db, course, checker }: { db: Db; course: Course; checker: Checker }) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
  app.use(express.json({ limit: '128kb' }));

  const allLessons = course.modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
  const refFor = (entry: { module: Module; lesson: Lesson } | undefined): LessonRef | null =>
    entry ? { moduleId: entry.module.id, lessonId: entry.lesson.id, title: entry.lesson.title } : null;

  const statesFor = (userId: number): Map<string, StateRow> => {
    const rows = db.prepare('SELECT * FROM activity_state WHERE user_id = ?').all(userId) as unknown as StateRow[];
    return new Map(rows.map((row) => [row.activity_id, row]));
  };

  const lessonSummary = (module: Module, lesson: Lesson, states: Map<string, StateRow>): LessonSummary => ({
    id: lesson.id,
    title: lesson.title,
    minutes: lesson.minutes,
    activities: lesson.activities.length,
    passed: lesson.activities.filter((a) => states.get(activityKey(module.id, lesson.id, a.id))?.passed_at).length,
  });

  const toState = (row: StateRow | undefined): ActivityState => ({
    attempts: row?.attempts ?? 0,
    passed: Boolean(row?.passed_at),
  });

  const requireUser: RequestHandler = (req, _res, next) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = token ? userForToken(db, token) : null;
    if (!user) return next(new HttpError(401, 'Sign in to continue.'));
    (req as AuthedRequest).user = user;
    next();
  };

  const requireInstructor: RequestHandler = (req, _res, next) => {
    if ((req as AuthedRequest).user.role !== 'instructor') return next(new HttpError(403, 'Instructors only.'));
    next();
  };

  const setSession = (req: Request, res: Response, userId: number) => {
    res.cookie(SESSION_COOKIE, createSession(db, userId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  };

  const authLimit = rateLimit(20, (req) => `auth:${req.ip}`);
  const checkLimit = rateLimit(150, (req) => `check:${(req as AuthedRequest).user.id}`);

  // ---- Accounts ----

  app.post('/api/auth/register', authLimit, async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!name || name.length > 80) throw new HttpError(400, 'Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email.');
    if (password.length < 8 || password.length > 200) throw new HttpError(400, 'Use a password of at least 8 characters.');
    const hash = await hashPassword(password);
    let row: { id: number; role: Role };
    try {
      // The role is decided inside the INSERT so two simultaneous first sign-ups can't both become instructor.
      row = db
        .prepare(
          `INSERT INTO users (name, email, password_hash, role)
           SELECT ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'learner' ELSE 'instructor' END
           RETURNING id, role`,
        )
        .get(name, email, hash) as unknown as { id: number; role: Role };
    } catch (error) {
      if (String(error).includes('UNIQUE')) throw new HttpError(409, 'That email already has an account.');
      throw error;
    }
    setSession(req, res, row.id);
    const user: User = { id: row.id, name, email, role: row.role };
    res.status(201).json(user);
  });

  app.post('/api/auth/login', authLimit, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '').slice(0, 200);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | { id: number; name: string; email: string; role: Role; password_hash: string }
      | undefined;
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'That email and password don’t match.');
    setSession(req, res, row.id);
    const user: User = { id: row.id, name: row.name, email: row.email, role: row.role };
    res.json(user);
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) destroySession(db, token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  app.get('/api/me', requireUser, (req, res) => {
    res.json((req as AuthedRequest).user);
  });

  // ---- Learning ----

  app.get('/api/course', requireUser, (req, res) => {
    const states = statesFor((req as AuthedRequest).user.id);
    const modules = course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      source: module.source,
      lessons: module.lessons.map((lesson) => lessonSummary(module, lesson, states)),
    }));
    const flat = modules.flatMap((module) => module.lessons);
    const nextEntry = allLessons.find(({ module, lesson }) => {
      const summary = lessonSummary(module, lesson, states);
      return summary.passed < summary.activities;
    });
    const overview: CourseOverview = {
      modules,
      totalActivities: flat.reduce((sum, lesson) => sum + lesson.activities, 0),
      passedActivities: flat.reduce((sum, lesson) => sum + lesson.passed, 0),
      next: refFor(nextEntry),
    };
    res.json(overview);
  });

  const findLesson = (moduleId: string, lessonId: string) => {
    const index = allLessons.findIndex((e) => e.module.id === moduleId && e.lesson.id === lessonId);
    const entry = allLessons[index];
    if (!entry) throw new HttpError(404, 'Lesson not found.');
    return { ...entry, index };
  };

  const findActivity = (req: Request) => {
    const moduleId = String(req.params.module);
    const lessonId = String(req.params.lesson);
    const activityId = String(req.params.activity);
    const { module, lesson } = findLesson(moduleId, lessonId);
    const activity = lesson.activities.find((a) => a.id === activityId);
    if (!activity) throw new HttpError(404, 'Activity not found.');
    return { module, lesson, activity, key: activityKey(module.id, lesson.id, activity.id) };
  };

  const needExercise = (activity: Activity): Exercise => {
    if (activity.kind !== 'exercise') throw new HttpError(400, 'Not a coding exercise.');
    return activity;
  };

  const readCode = (req: Request): string => {
    const code = req.body?.code;
    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) {
      throw new HttpError(400, 'Code is missing or too long.');
    }
    return code;
  };

  const check = async (exercise: Exercise, code: string) => {
    try {
      return await checker.run({ code, check: exercise.check, support: exercise.support });
    } catch (error) {
      if (error instanceof QueueFullError) throw new HttpError(503, 'The grader is busy. Try again in a moment.');
      throw error;
    }
  };

  /** Records an attempt. first_score is written once, so retries can't change the first-try signal. */
  const recordAttempt = (userId: number, key: string, score: number, passed: boolean, draft: string): ActivityState => {
    const row = db
      .prepare(
        `INSERT INTO activity_state (user_id, activity_id, attempts, first_score, best_score, passed_at, draft)
         VALUES (:user, :key, 1, :score, :score, CASE WHEN :passed THEN datetime('now') END, :draft)
         ON CONFLICT (user_id, activity_id) DO UPDATE SET
           attempts = attempts + 1,
           first_score = COALESCE(first_score, :score),
           best_score = MAX(COALESCE(best_score, 0), :score),
           passed_at = COALESCE(passed_at, CASE WHEN :passed THEN datetime('now') END),
           draft = :draft
         RETURNING *`,
      )
      .get({ user: userId, key, score, passed: passed ? 1 : 0, draft }) as unknown as StateRow;
    db.prepare(`UPDATE users SET last_active_at = datetime('now') WHERE id = ?`).run(userId);
    return toState(row);
  };

  app.get('/api/lessons/:module/:lesson', requireUser, (req, res) => {
    const { module, lesson, index } = findLesson(String(req.params.module), String(req.params.lesson));
    const states = statesFor((req as AuthedRequest).user.id);
    const blocks = lesson.blocks.map((block): LessonDetail['blocks'][number] => {
      if (block.kind === 'html') return { kind: 'html', html: block.html };
      const row = states.get(activityKey(module.id, lesson.id, block.id));
      const state = toState(row);
      if (block.kind === 'quiz') {
        let review;
        if (state.passed && row?.draft) {
          const answers = JSON.parse(row.draft) as number[][];
          review = { answers, result: gradeQuiz(block, answers) };
        }
        return {
          kind: 'quiz',
          id: block.id,
          state,
          ...(review ? { review } : {}),
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
        draft: row?.draft ?? null,
      };
    });
    const detail: LessonDetail = {
      moduleId: module.id,
      moduleTitle: module.title,
      lessonId: lesson.id,
      title: lesson.title,
      minutes: lesson.minutes,
      source: module.source,
      blocks,
      siblings: module.lessons.map((l) => lessonSummary(module, l, states)),
      prev: refFor(allLessons[index - 1]),
      next: refFor(allLessons[index + 1]),
    };
    res.json(detail);
  });

  const activityPath = '/api/activities/:module/:lesson/:activity';

  // Live feedback while typing. Doesn't count as an attempt.
  app.post(`${activityPath}/check`, requireUser, checkLimit, async (req, res) => {
    const exercise = needExercise(findActivity(req).activity);
    res.json(await check(exercise, readCode(req)));
  });

  app.put(`${activityPath}/draft`, requireUser, checkLimit, (req, res) => {
    const { key, activity } = findActivity(req);
    needExercise(activity);
    db.prepare(
      `INSERT INTO activity_state (user_id, activity_id, draft) VALUES (?, ?, ?)
       ON CONFLICT (user_id, activity_id) DO UPDATE SET draft = excluded.draft`,
    ).run((req as AuthedRequest).user.id, key, readCode(req));
    res.status(204).end();
  });

  app.post(`${activityPath}/submit`, requireUser, checkLimit, async (req, res) => {
    const { key, activity } = findActivity(req);
    const userId = (req as AuthedRequest).user.id;
    if (activity.kind === 'quiz') {
      const answers = parseAnswers(req.body?.answers, activity);
      const result = gradeQuiz(activity, answers);
      const response: SubmitQuizResponse = {
        result,
        state: recordAttempt(userId, key, result.score, result.passed, JSON.stringify(answers)),
      };
      res.json(response);
      return;
    }
    const code = readCode(req);
    const result = await check(activity, code);
    // A check abandoned for server reasons says nothing about the learner.
    if (result.timedOut) {
      const row = statesFor(userId).get(key);
      const state = toState(row);
      const response: SubmitExerciseResponse = {
        result,
        state,
        solutionAvailable: state.passed || state.attempts >= SOLUTION_AFTER_ATTEMPTS,
      };
      res.json(response);
      return;
    }
    const passedTests = result.tests.filter((t) => t.passed).length;
    const score = result.passed ? 1 : result.tests.length ? (passedTests / result.tests.length) * 0.99 : 0;
    const state = recordAttempt(userId, key, score, result.passed, code);
    const response: SubmitExerciseResponse = {
      result,
      state,
      solutionAvailable: state.passed || state.attempts >= SOLUTION_AFTER_ATTEMPTS,
    };
    res.json(response);
  });

  app.get(`${activityPath}/solution`, requireUser, (req, res) => {
    const { key, activity } = findActivity(req);
    const exercise = needExercise(activity);
    const state = toState(statesFor((req as AuthedRequest).user.id).get(key));
    if (!state.passed && state.attempts < SOLUTION_AFTER_ATTEMPTS) {
      throw new HttpError(403, `The solution unlocks after ${SOLUTION_AFTER_ATTEMPTS} submissions.`);
    }
    res.json({ solution: exercise.solution });
  });

  // ---- Instructor ----

  app.get('/api/instructor/gradebook', requireUser, requireInstructor, (_req, res) => {
    const users = db.prepare('SELECT id, name, email, role, last_active_at FROM users ORDER BY name COLLATE NOCASE').all() as unknown as {
      id: number;
      name: string;
      email: string;
      role: Role;
      last_active_at: string | null;
    }[];
    const all = db.prepare('SELECT user_id, activity_id, attempts, first_score, passed_at FROM activity_state').all() as unknown as {
      user_id: number;
      activity_id: string;
      attempts: number;
      first_score: number | null;
      passed_at: string | null;
    }[];

    const entries = course.modules.flatMap((module) =>
      module.lessons.flatMap((lesson) =>
        lesson.activities.map((activity) => ({
          module,
          lesson,
          activity,
          key: activityKey(module.id, lesson.id, activity.id),
        })),
      ),
    );
    const known = new Map(entries.map((entry) => [entry.key, entry]));

    const byUser = new Map<number, typeof all>();
    for (const row of all) {
      if (!known.has(row.activity_id)) continue;
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
    }

    const rows: GradebookRow[] = users.map((user) => {
      const own = byUser.get(user.id) ?? [];
      const passed = new Set(own.filter((r) => r.passed_at).map((r) => r.activity_id));
      const scored = own.filter((r) => r.first_score !== null);
      const pct = (list: typeof entries) =>
        list.length ? Math.round((100 * list.filter((e) => passed.has(e.key)).length) / list.length) : 0;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastActive: user.last_active_at,
        overall: pct(entries),
        firstTryAverage: scored.length
          ? Math.round((100 * scored.reduce((sum, r) => sum + (r.first_score ?? 0), 0)) / scored.length)
          : null,
        modules: course.modules.map((module) => pct(entries.filter((e) => e.module === module))),
      };
    });

    const hardest: ItemStat[] = entries
      .flatMap((entry) => {
        const attempts = all.filter((r) => r.activity_id === entry.key && r.first_score !== null);
        if (attempts.length === 0) return [];
        return [
          {
            activityId: entry.key,
            label: `${entry.lesson.title}${entry.activity.kind === 'exercise' ? ` · ${entry.activity.title}` : ' · Quiz'}`,
            kind: entry.activity.kind,
            learners: attempts.length,
            passed: attempts.filter((r) => r.passed_at).length,
            firstTryAverage: Math.round(
              (100 * attempts.reduce((sum, r) => sum + (r.first_score ?? 0), 0)) / attempts.length,
            ),
            averageAttempts: attempts.reduce((sum, r) => sum + r.attempts, 0) / attempts.length,
          },
        ];
      })
      .sort((a, b) => a.firstTryAverage - b.firstTryAverage)
      .slice(0, 10);

    const response: GradebookResponse = {
      modules: course.modules.map((module) => ({ id: module.id, title: module.title })),
      rows,
      hardest,
    };
    res.json(response);
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  return {
    app,
    /** Registered last, after any static/SPA middleware. */
    errorHandler: (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        res.status(status).json({ error: 'That request couldn’t be read.' });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Something went wrong on the server.' });
    },
  };
}
