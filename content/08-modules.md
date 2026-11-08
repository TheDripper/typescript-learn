---
id: modules
title: Modules
summary: Organizing code with ES modules, importing types, and how TypeScript's module options shape the output.
source: https://www.typescriptlang.org/docs/handbook/2/modules.html
---

@lesson es-modules | ES modules in TypeScript | 8

Any file with a top-level `import` or `export` is a **module**, with its own scope. A file with neither is a **script**, whose declarations are global. To make a file with no imports or exports a module, add `export {}`.

## Import and export forms

```ts nocheck
// maths.ts
export const pi = 3.14;
export default function square(x: number) {
  return x * x;
}

// app.ts
import square, { pi as PI } from "./maths.js";
import * as maths from "./maths.js";
```

## Importing types

Types can be exported and imported with ordinary syntax. TypeScript also has two forms that say "this is only a type", which are guaranteed to be erased:

```ts nocheck
// animal.ts
export type Cat = { breed: string };
export function makeCat(): Cat {
  return { breed: "Tabby" };
}

// app.ts
import type { Cat } from "./animal.js";    // The whole import is type-only.
import { makeCat, type Cat as C } from "./animal.js"; // One type-only name.
```

A `type`-only import can't be used as a value. The `verbatimModuleSyntax` option makes the rule simple: imports without `type` are preserved in the output, and imports with `type` are dropped.

@quiz check
@q What makes a TypeScript file a module?
- [x] A top-level `import` or `export`
- [ ] A `.mts` extension is always required
- [ ] A `module` declaration at the top
@why With no top-level `import` or `export`, a file is treated as a script with global declarations.
@q Why use `import type`?
- [ ] To speed up runtime type checks
- [x] To guarantee that the import is removed from the JavaScript output
- [ ] To import from a `.d.ts` file only
@why Type-only imports are always erased, so they can't cause a runtime dependency.
@end

@exercise module-exports | Export and import types
The hidden tests import from your file, so you must use real exports. Export an `interface Book` with a string `title` and a numeric `year`. Export a function `isClassic(book: Book): boolean`. And use a type-only import to bring `Id` in from `./ids` so that you can export `type BookId = Id`.

```ts support:ids.ts
export type Id = string;
```
```ts starter
interface Book {}

function isClassic(book) {
  return book.year < 1950;
}
```
```ts solution
import type { Id } from "./ids";

export interface Book {
  title: string;
  year: number;
}

export function isClassic(book: Book): boolean {
  return book.year < 1950;
}

export type BookId = Id;
```
```ts check
import { isClassic, type Book, type BookId } from "./main";
// @test `Book` has a title and a year
type _book = Expect<Equal<Book, { title: string; year: number }>>;
// @test `isClassic` takes a Book and returns a boolean
type _classic = Expect<Equal<typeof isClassic, (book: Book) => boolean>>;
// @test `BookId` is the type from ./ids
type _bookId = Expect<Equal<BookId, string>>;
```
@hint Use `export` on each declaration and `import type { Id } from "./ids";` at the top of the file.
@end

@lesson resolution-and-output | Resolution, output and namespaces | 7

## Module resolution

Module resolution is how TypeScript turns the string in an `import` into a file. Which rules apply is set by `moduleResolution`:

- `nodenext` follows how Node.js finds files, and is the right choice for code run directly in Node.
- `bundler` models tools like Vite and esbuild, where extensions can be omitted.

The Handbook's Modules chapter still describes the older `classic` and `node10` strategies. As of TypeScript 6.0 both of those are **deprecated**, and they stop working in 7.0.

## Module output

Two compiler options shape the emitted JavaScript:

- `target` decides which syntax is downleveled.
- `module` decides how modules talk to each other.

Given this input:

```ts nocheck
import { valueOfPi } from "./constants.js";
export const twoPi = valueOfPi * 2;
```

With `--module es2020` the output is effectively unchanged. With `--module commonjs` it uses `require` and `exports`:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoPi = void 0;
const constants_js_1 = require("./constants.js");
exports.twoPi = constants_js_1.valueOfPi * 2;
```

`amd` and `umd` output are also deprecated as of TypeScript 6.0.

## CommonJS

Older Node.js code uses `module.exports` and `require`. TypeScript's `esModuleInterop` option smooths over the differences when you import CommonJS code using ES syntax.

## Namespaces

`namespace` is TypeScript's own module format, from before ES modules existed. It remains in use, especially in declaration files on DefinitelyTyped, but new code should use ES modules. Write it with the `namespace` keyword, as the old `module Foo {}` spelling is now an error:

```ts
namespace Validation {
  export const minLength = 3;
}

module Legacy { // ✗ Use the 'namespace' keyword.
  export const value = 1;
}
```

@quiz check
@q Which compiler option decides whether the output uses `require` or `import`?
- [x] `module`
- [ ] `target`
- [ ] `strict`
@why `module` sets the module format, while `target` handles language-level syntax.
@q For an application bundled by Vite, which `moduleResolution` fits best?
- [ ] `classic`
- [ ] `node10`
- [x] `bundler`
@why `bundler` matches how such tools find files. `classic` and `node10` are deprecated as of TypeScript 6.0.
@q What's the recommendation for new code that needs to organize declarations?
- [x] Use ES modules
- [ ] Use `namespace`
- [ ] Use global script files
@why Namespaces still work, but most of their features exist in ES modules, which are the standard.
@end
