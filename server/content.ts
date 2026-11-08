// Loads the course from content/*.md. See README.md for the authoring format.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { createHighlighter } from 'shiki';
import { parseTests } from './grader.ts';

export interface Choice {
  html: string;
  correct: boolean;
}

export interface Question {
  promptHtml: string;
  choices: Choice[];
  whyHtml: string;
}

export interface Quiz {
  kind: 'quiz';
  id: string;
  questions: Question[];
}

export interface Exercise {
  kind: 'exercise';
  id: string;
  title: string;
  promptHtml: string;
  starter: string;
  solution: string;
  check: string;
  hints: string[];
  support: { name: string; code: string }[];
}

export type Activity = Quiz | Exercise;
export type Block = { kind: 'html'; html: string; markdown: string } | Activity;

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  blocks: Block[];
  activities: Activity[];
}

export interface Module {
  id: string;
  title: string;
  summary: string;
  source: string;
  lessons: Lesson[];
}

export interface Course {
  modules: Module[];
}

export const activityKey = (moduleId: string, lessonId: string, activityId: string) =>
  `${moduleId}/${lessonId}/${activityId}`;

type Renderer = { block(md: string): string; inline(md: string): string };

async function createRenderer(): Promise<Renderer> {
  const highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: ['typescript', 'javascript', 'json', 'bash', 'tsx'],
  });
  const known = new Set(highlighter.getLoadedLanguages());
  const marked = new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        const first = (lang ?? '').split(/\s+/)[0] || 'text';
        return highlighter.codeToHtml(text, {
          lang: known.has(first) ? first : 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });
      },
    },
  });
  return {
    block: (md) => marked.parse(md, { async: false }),
    inline: (md) => marked.parseInline(md, { async: false }),
  };
}

function fail(file: string, line: number, reason: string): never {
  throw new Error(`${file}:${line + 1}: ${reason}`);
}

/** Returns, for every line, whether it sits inside or delimits a fenced code block. */
function fencedLines(lines: string[]): boolean[] {
  let open = false;
  return lines.map((line) => {
    if (/^```/.test(line)) {
      open = !open;
      return true;
    }
    return open;
  });
}

function parseFrontmatter(file: string, lines: string[]): { meta: Record<string, string>; body: number } {
  if (lines[0] !== '---') fail(file, 0, 'expected frontmatter');
  const end = lines.indexOf('---', 1);
  if (end < 0) fail(file, 0, 'unterminated frontmatter');
  const meta: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(':');
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { meta, body: end + 1 };
}

function parseQuiz(file: string, start: number, id: string, lines: string[], render: Renderer): Quiz {
  const questions: Question[] = [];
  type Draft = { prompt: string[]; choices: Choice[]; why: string[]; section: 'prompt' | 'why' };
  let draft: Draft | null = null;
  const fenced = fencedLines(lines);
  const flush = () => {
    if (!draft) return;
    if (!draft.choices.some((c) => c.correct)) fail(file, start, `quiz ${id}: a question has no correct choice`);
    if (draft.choices.length < 2) fail(file, start, `quiz ${id}: a question needs at least two choices`);
    if (!draft.why.join('').trim()) fail(file, start, `quiz ${id}: a question has no @why`);
    questions.push({
      promptHtml: render.block(draft.prompt.join('\n')),
      choices: draft.choices,
      whyHtml: render.block(draft.why.join('\n')),
    });
  };
  lines.forEach((line, i) => {
    const q = fenced[i] ? null : /^@q\s+(.*)$/.exec(line);
    const choice = fenced[i] ? null : /^- \[( |x)\] (.*)$/.exec(line);
    const why = fenced[i] ? null : /^@why\s+(.*)$/.exec(line);
    if (q) {
      flush();
      draft = { prompt: [q[1] ?? ''], choices: [], why: [], section: 'prompt' };
    } else if (!draft) {
      if (line.trim()) fail(file, start + i, `quiz ${id}: expected @q`);
    } else if (choice) {
      draft.choices.push({ html: render.inline(choice[2] ?? ''), correct: choice[1] === 'x' });
    } else if (why) {
      draft.section = 'why';
      draft.why.push(why[1] ?? '');
    } else {
      draft[draft.section].push(line);
    }
  });
  flush();
  if (questions.length === 0) fail(file, start, `quiz ${id}: no questions`);
  return { kind: 'quiz', id, questions };
}

function parseExercise(
  file: string,
  start: number,
  id: string,
  title: string,
  lines: string[],
  render: Renderer,
): Exercise {
  const prompt: string[] = [];
  const hints: string[] = [];
  const fences: Record<string, string> = {};
  const support: { name: string; code: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const fence = /^```ts (starter|solution|check|support:(\S+))\s*$/.exec(line);
    if (fence) {
      const close = lines.indexOf('```', i + 1);
      if (close < 0) fail(file, start + i, 'unterminated code fence');
      const code = lines.slice(i + 1, close).join('\n') + '\n';
      if (fence[2]) support.push({ name: fence[2], code });
      else fences[fence[1] ?? ''] = code;
      i = close;
    } else if (line.startsWith('@hint ')) {
      hints.push(line.slice(6).trim());
    } else if (/^```/.test(line)) {
      const close = lines.indexOf('```', i + 1);
      if (close < 0) fail(file, start + i, 'unterminated code fence');
      prompt.push(...lines.slice(i, close + 1));
      i = close;
    } else {
      prompt.push(line);
    }
  }
  const { starter, solution, check } = fences;
  if (starter === undefined || solution === undefined || check === undefined) {
    fail(file, start, `exercise ${id}: needs starter, solution and check blocks`);
  }
  if (parseTests(check).length === 0) fail(file, start, `exercise ${id}: check has no // @test labels`);
  return {
    kind: 'exercise',
    id,
    title,
    promptHtml: render.block(prompt.join('\n')),
    starter,
    solution,
    check,
    hints,
    support,
  };
}

function parseModule(file: string, text: string, render: Renderer): Module {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const { meta, body } = parseFrontmatter(file, lines);
  const { id, title, summary, source } = meta;
  if (!id || !title || !summary || !source) fail(file, 0, 'frontmatter needs id, title, summary and source');

  const fenced = fencedLines(lines);
  const lessons: Lesson[] = [];
  let lesson: Lesson | null = null;
  let prose: string[] = [];
  const flushProse = () => {
    const markdown = prose.join('\n').trim();
    if (markdown && lesson) lesson.blocks.push({ kind: 'html', html: render.block(markdown), markdown });
    prose = [];
  };
  const seen = new Set<string>();

  for (let i = body; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (fenced[i]) {
      prose.push(line);
      continue;
    }
    const lessonMatch = /^@lesson\s+(\S+)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*$/.exec(line);
    const activityMatch = /^@(quiz|exercise)\s+([\w-]+)(?:\s*\|\s*(.+?))?\s*$/.exec(line);
    if (lessonMatch) {
      flushProse();
      lesson = {
        id: lessonMatch[1] ?? '',
        title: lessonMatch[2] ?? '',
        minutes: Number(lessonMatch[3]),
        blocks: [],
        activities: [],
      };
      lessons.push(lesson);
    } else if (activityMatch) {
      if (!lesson) fail(file, i, 'activity outside a lesson');
      flushProse();
      let end = i + 1;
      while (end < lines.length && (fenced[end] || lines[end] !== '@end')) end++;
      if (end === lines.length) fail(file, i, 'activity has no @end');
      const inner = lines.slice(i + 1, end);
      const activityId = activityMatch[2] ?? '';
      const key = `${lesson.id}/${activityId}`;
      if (seen.has(key)) fail(file, i, `duplicate activity ${key}`);
      seen.add(key);
      const activity: Activity =
        activityMatch[1] === 'quiz'
          ? parseQuiz(file, i + 1, activityId, inner, render)
          : parseExercise(file, i + 1, activityId, activityMatch[3] ?? 'Exercise', inner, render);
      lesson.blocks.push(activity);
      lesson.activities.push(activity);
      i = end;
    } else if (lesson) {
      prose.push(line);
    } else if (line.trim()) {
      fail(file, i, 'content before the first @lesson');
    }
  }
  flushProse();

  for (const l of lessons) {
    if (l.activities.length === 0) fail(file, body, `lesson ${l.id} has no activities`);
  }
  return { id, title, summary, source, lessons };
}

export async function loadCourse(dir: string): Promise<Course> {
  const render = await createRenderer();
  const modules = readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => parseModule(name, readFileSync(path.join(dir, name), 'utf8'), render));
  return { modules };
}
