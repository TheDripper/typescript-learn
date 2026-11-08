# Strict Mode

A learning management system for TypeScript, built on [The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html). It has 8 modules and 31 lessons, with quizzes and coding exercises graded by the real TypeScript compiler.

## Run it

Requires Node.js 23.6 or later, which runs the server's TypeScript directly.

```bash
npm install
npm run dev              # http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

**The first account registered becomes the instructor** and can open the Gradebook. Everyone after that is a learner, so register your own account before you share the URL.

| Variable      | Default            | Purpose                                                  |
| ------------- | ------------------ | -------------------------------------------------------- |
| `PORT`        | `3000`             | HTTP port                                                |
| `LMS_DB`      | `data/lms.sqlite`  | SQLite database file                                     |
| `TRUST_PROXY` | unset              | Number of proxy hops. Set behind a TLS proxy so cookies are marked `Secure` |

## Static version (Netlify)

`npm run build:static` produces `dist-static/`, a version that needs no server. The compiler runs in a browser Web Worker and progress is saved in `localStorage`. `netlify.toml` configures this build.

Compared with the Node version, it has no accounts or gradebook, progress doesn't follow a learner between browsers, and quiz answers and solutions ship to the browser, so anyone inspecting the page can read them.

## What it does

**Learners** read short lessons, answer quizzes and solve exercises in a code editor. Compiler errors appear as they type, and the requirements list updates live. Each exercise has progressive hints, and its solution unlocks after two submissions. Progress and drafts are saved to their account.

**Instructors** get a gradebook showing completion per module, first-try scores and the activities learners find hardest.

## How grading works

Exercises are graded by type-checking only. **Learner code is never executed.** The learner's file and a hidden test file are compiled together with `strict` on, in a virtual file system that can see nothing but TypeScript's own lib files. The compiler runs on a worker thread with a time and memory limit, because a type can be made arbitrarily expensive to check.

To pass, the learner's code must have no errors, every hidden test must hold, and it can't use `@ts-ignore`, `@ts-nocheck` or `@ts-expect-error`.

Quiz answers, exercise solutions and hidden tests stay on the server until they've been earned.

## Writing content

Each module is one Markdown file in `content/`, ordered by filename. Restart the server to pick up edits (`npm run dev` does this for you).

````markdown
---
id: my-module
title: My Module
summary: One sentence for the course page.
source: https://www.typescriptlang.org/docs/handbook/2/example.html
---

@lesson my-lesson | Lesson title | 8

Markdown prose. Every `ts` block is compiled by `npm run validate`.

```ts
const n: number = "x"; // ✗ Mark every line that should have an error like this.
```

@quiz check
@q Question text?
- [ ] A wrong choice
- [x] The right choice (mark two or more for a choose-all question)
@why Shown after the learner answers.
@end

@exercise my-exercise | Exercise title
Instructions in Markdown.

```ts starter
const value = 1;
```
```ts solution
const value: string = "1";
```
```ts check
// @test `value` is a string
type _value = Expect<Equal<typeof value, string>>;
```
@hint Optional. Revealed one at a time.
@end
````

Each `// @test label` in a `check` block starts a test, and any compile error up to the next label fails it. `Expect<Equal<A, B>>` asserts two types are identical, and `// @ts-expect-error` asserts that misuse is rejected. Use ` ```ts nocheck ` to skip validating an example that needs multiple files. A ` ```ts support:name.ts ` block in an exercise adds a read-only file that learners can import.

Keep `id`s stable once learners have started, because progress is stored against them.

## Checks

```bash
npm run validate    # every example compiles as marked; each starter fails and each solution passes
npm test            # grader and API tests
npm run typecheck
```

## Notes

- The compiler is pinned to TypeScript 6.0.3. TypeScript 7 is the current release, but its compiler API is still marked unstable, and the grader depends on that API.
- Some lessons intentionally differ from the Handbook text where the Handbook lags the compiler. For example, `strict` is on by default as of 6.0, and the `classic` and `node10` resolution modes and `amd` and `umd` output are deprecated.

## Attribution

Lesson content is adapted from [The TypeScript Handbook](https://github.com/microsoft/TypeScript-Website) by Microsoft and contributors, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It has been rewritten, updated and extended with quizzes and exercises. This project isn't affiliated with or endorsed by Microsoft.
