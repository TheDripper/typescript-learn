// Types shared by the API server and the React client.

/** Submissions needed before an exercise's solution unlocks. */
export const SOLUTION_AFTER_ATTEMPTS = 2;

export type Role = 'learner' | 'instructor';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LessonSummary {
  id: string;
  title: string;
  minutes: number;
  activities: number;
  passed: number;
}

export interface ModuleSummary {
  id: string;
  title: string;
  summary: string;
  source: string;
  lessons: LessonSummary[];
}

export interface LessonRef {
  moduleId: string;
  lessonId: string;
  title: string;
}

export interface CourseOverview {
  modules: ModuleSummary[];
  totalActivities: number;
  passedActivities: number;
  next: LessonRef | null;
}

export interface PublicChoice {
  html: string;
}

export interface PublicQuestion {
  promptHtml: string;
  choices: PublicChoice[];
  multi: boolean;
}

export interface QuestionResult {
  correct: boolean;
  correctChoices: number[];
  whyHtml: string;
}

export interface QuizResult {
  passed: boolean;
  score: number;
  questions: QuestionResult[];
}

export interface PublicQuiz {
  kind: 'quiz';
  id: string;
  questions: PublicQuestion[];
  state: ActivityState;
  /** Present once the quiz has been passed, so a return visit shows the review. */
  review?: { answers: number[][]; result: QuizResult };
}

export interface PublicExercise {
  kind: 'exercise';
  id: string;
  title: string;
  promptHtml: string;
  starter: string;
  hints: string[];
  tests: string[];
  support: { name: string; code: string }[];
  state: ActivityState;
  draft: string | null;
}

export interface ActivityState {
  attempts: number;
  passed: boolean;
}

export type LessonBlock = { kind: 'html'; html: string } | PublicQuiz | PublicExercise;

export interface LessonDetail {
  moduleId: string;
  moduleTitle: string;
  lessonId: string;
  title: string;
  minutes: number;
  source: string;
  blocks: LessonBlock[];
  siblings: LessonSummary[];
  prev: LessonRef | null;
  next: LessonRef | null;
}

export interface Diagnostic {
  from: number;
  to: number;
  line: number;
  column: number;
  message: string;
}

export interface TestResult {
  label: string;
  passed: boolean;
}

export interface CheckResult {
  passed: boolean;
  diagnostics: Diagnostic[];
  tests: TestResult[];
  /** The hidden tests could not attach to the learner's code (e.g. a missing export). */
  setupError?: string;
  timedOut?: boolean;
}

export interface SubmitExerciseResponse {
  result: CheckResult;
  state: ActivityState;
  solutionAvailable: boolean;
}

export interface SubmitQuizResponse {
  result: QuizResult;
  state: ActivityState;
}

export interface GradebookRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  lastActive: string | null;
  overall: number;
  firstTryAverage: number | null;
  /** Percentage complete, parallel to GradebookResponse.modules. */
  modules: number[];
}

export interface ItemStat {
  activityId: string;
  label: string;
  kind: 'quiz' | 'exercise';
  learners: number;
  passed: number;
  firstTryAverage: number;
  averageAttempts: number;
}

export interface GradebookResponse {
  modules: { id: string; title: string }[];
  rows: GradebookRow[];
  hardest: ItemStat[];
}
