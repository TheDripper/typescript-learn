import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.ts';
import { Checker } from './checker.ts';
import { loadCourse } from './content.ts';
import { openDb } from './db.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 3000);
const production = process.env.NODE_ENV === 'production';

const db = openDb(process.env.LMS_DB ?? path.join(root, 'data', 'lms.sqlite'));
const course = await loadCourse(path.join(root, 'content'));
const checker = new Checker();
const { app, errorHandler } = createApp({ db, course, checker });

if (production) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use(errorHandler);

app.listen(port, () => {
  const lessons = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  console.log(`Strict Mode: ${course.modules.length} modules, ${lessons} lessons at http://localhost:${port}`);
});
