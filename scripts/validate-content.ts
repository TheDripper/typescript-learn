// Proves the course content against the real compiler:
//  - every exercise's starter fails and its solution passes
//  - every ```ts example compiles, with errors on exactly the lines marked ✗
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourse } from '../server/content.ts';
import { checkExercise, errorLines } from '../server/grader.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const course = await loadCourse(process.argv[2] ?? path.join(root, 'content'));
const problems: string[] = [];
let exercises = 0;
let snippets = 0;
let quizzes = 0;

for (const module of course.modules) {
  for (const lesson of module.lessons) {
    const where = `${module.id}/${lesson.id}`;
    for (const block of lesson.blocks) {
      if (block.kind === 'quiz') {
        quizzes++;
      } else if (block.kind === 'exercise') {
        exercises++;
        const input = { check: block.check, support: block.support };
        const start = checkExercise({ code: block.starter, ...input });
        if (start.passed) problems.push(`${where}/${block.id}: starter already passes`);
        const end = checkExercise({ code: block.solution, ...input });
        if (!end.passed) {
          problems.push(
            `${where}/${block.id}: solution fails\n    ${JSON.stringify({
              diagnostics: end.diagnostics.map((d) => `L${d.line}: ${d.message}`),
              failed: end.tests.filter((t) => !t.passed).map((t) => t.label),
              setup: end.setupError,
            })}`,
          );
        }
      } else {
        for (const match of block.markdown.matchAll(/^```ts( nocheck)?\n([\s\S]*?)^```$/gm)) {
          if (match[1]) continue;
          snippets++;
          const code = match[2] ?? '';
          const expected = code.split('\n').flatMap((line, i) => (line.includes('✗') ? [i + 1] : []));
          const actual = errorLines(code);
          const unexpected = actual.filter((e) => !expected.includes(e.line));
          const missing = expected.filter((line) => !actual.some((e) => e.line === line));
          if (unexpected.length || missing.length) {
            problems.push(
              `${where}: example mismatch\n${code.replace(/^/gm, '    | ')}\n    unexpected: ${JSON.stringify(unexpected)}\n    missing errors on lines: ${JSON.stringify(missing)}`,
            );
          }
        }
      }
    }
  }
}

console.log(`Checked ${exercises} exercises, ${quizzes} quizzes, ${snippets} code examples.`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n\n${problems.join('\n\n')}`);
  process.exit(1);
}
console.log('All content is valid.');
