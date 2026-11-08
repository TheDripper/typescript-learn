// Writes the data files the static (Netlify) build loads at runtime:
//   course.json  the compiled course, including answers
//   tslib.json   the TypeScript lib files the in-browser compiler needs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { loadCourse } from '../server/content.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-static');

const course = await loadCourse(path.join(root, 'content'));
for (const module of course.modules) {
  for (const lesson of module.lessons) {
    lesson.blocks = lesson.blocks.map((block) => (block.kind === 'html' ? { ...block, markdown: '' } : block));
  }
}
writeFileSync(path.join(out, 'course.json'), JSON.stringify(course));

const libDir = path.dirname(ts.getDefaultLibFilePath({}));
const libs: Record<string, string> = {};
const visit = (name: string) => {
  if (libs[name] !== undefined) return;
  const text = readFileSync(path.join(libDir, name), 'utf8');
  libs[name] = text;
  for (const match of text.matchAll(/\/\/\/\s*<reference lib="([^"]+)"/g)) visit(`lib.${match[1]}.d.ts`);
};
visit('lib.es2022.d.ts');
writeFileSync(path.join(out, 'tslib.json'), JSON.stringify(libs));
// Lets deep links such as /learn/basics/tsc load the app. Real files still take priority.
writeFileSync(path.join(out, '_redirects'), '/* /index.html 200\n');

console.log(`Wrote course.json and tslib.json (${Object.keys(libs).length} lib files) to dist-static/`);
