---
id: basics
title: The Basics
summary: What a static type-checker does for you, how tsc turns TypeScript into JavaScript, and why strictness matters.
source: https://www.typescriptlang.org/docs/handbook/2/basic-types.html
---

@lesson static-checking | Why check types before running? | 6

Every JavaScript value has behaviors you discover by running it. Can you call it? Does it have a `.length`? In plain JavaScript the only way to find out is to execute the program and see what happens.

A **static type-checker** answers those questions before the program runs. It describes the *shape* of each value, and reports code that doesn't respect that shape.

```ts
const message = "hello!";
message(); // ✗ This expression is not callable.
```

JavaScript would throw a `TypeError` at runtime. TypeScript flags it while you are still typing.

## Bugs that don't throw

The bigger win is catching code that JavaScript happily accepts. Reading a missing property doesn't throw, it quietly gives you `undefined`. TypeScript treats that as a mistake:

```ts
const user = { name: "Daniel", age: 26 };
user.location; // ✗ Property 'location' does not exist on this type.
```

The same goes for typos, functions you forgot to call, and logic that can never be true:

```ts
const announcement = "Hello World!";
announcement.toLocaleLowercase(); // ✗ Did you mean 'toLocaleLowerCase'?

function flipCoin() {
  return Math.random < 0.5; // ✗ Forgot the parentheses on Math.random().
}

const value = Math.random() < 0.5 ? "a" : "b";
if (value !== "a") {
  // ...
} else if (value === "b") { // ✗ This branch is unreachable: value can only be "a" here.
  // ...
}
```

## Types power your editor

Because the checker knows your types, editors can offer completions, jump to definitions, rename symbols safely and suggest quick fixes. The same engine powers both the errors and the tooling.

@quiz check
@q Which of these does TypeScript report even though JavaScript would run it without throwing?
- [ ] Calling a string as if it were a function
- [x] Reading a property that doesn't exist on an object
- [ ] Reading a property of `undefined`
@why Reading a missing property just yields `undefined` at runtime. The other two both throw a `TypeError`, so they would fail in JavaScript too. Catching the silent case is where a checker helps most.
@q Why does TypeScript report an error on `Math.random < 0.5`?
- [ ] `Math.random` is deprecated
- [x] It compares the function itself with a number, because the call parentheses are missing
- [ ] `<` can only be used in an `if` condition
@why Without `()` you are comparing a function to a number. That runs in JavaScript but is almost never what you meant.
@end

@lesson tsc | tsc and what happens to your types | 8

`tsc` is the TypeScript compiler. It does two separate jobs: it **checks** your code and it **emits** JavaScript.

```bash
npm install -g typescript
tsc hello.ts   # writes hello.js next to it
```

## Errors don't block output by default

If checking finds errors, `tsc` still writes the JavaScript and reports the errors. This reflects a core idea: *you know better than TypeScript*. When migrating a working program, you shouldn't have to fix every error before it can run. For a stricter build, pass `--noEmitOnError`.

## Adding explicit types

A type annotation describes what a value must be:

```ts
function greet(person: string, date: Date) {
  console.log(`Hello ${person}, today is ${date.toDateString()}!`);
}

greet("Maddison", Date()); // ✗ Date() returns a string. You wanted new Date().
greet("Maddison", new Date());
```

Annotations are often optional, because TypeScript **infers** types where it can. Here `msg` is known to be a `string` without any help:

```ts
let msg = "hello there!";
```

Don't add annotations the checker can already work out.

## Types are erased

Type annotations aren't JavaScript, so they are removed during compilation. The `greet` function above emits as:

```js
function greet(person, date) {
  console.log(`Hello ${person}, today is ${date.toDateString()}!`);
}
```

**Types never change how your program runs.** There is no runtime trace of them to inspect.

## Downleveling

`tsc` can also rewrite newer syntax for older runtimes, controlled by `target`. With `--target es2015`, the `??` operator (added in ES2020) is rewritten as a conditional, while template strings stay as they are because ES2015 has them.

@quiz check
@q By default, what does `tsc` do when your file has a type error?
- [ ] Refuses to write any JavaScript
- [x] Reports the error and still writes the JavaScript
- [ ] Rewrites the code to fix the error
@why Emitting anyway is the default, so type errors don't stand between you and running your code. `--noEmitOnError` opts out.
@q What effect do type annotations have on your program at runtime?
- [x] None, they are erased during compilation
- [ ] They add runtime checks for argument types
- [ ] They make property access faster
@why Annotations disappear from the emitted JavaScript. If you need a runtime check, you have to write one.
@q What does the `target` option control?
- [ ] Which files get compiled
- [ ] How strict type-checking is
- [x] Which JavaScript version the emitted code is written for
@why `target` decides which newer syntax gets downleveled for older runtimes.
@end

@lesson strictness | Strictness | 7

Static checking is a dial rather than a switch, and the `strict` flag turns on the whole family of strictness checks at once. Since TypeScript 6.0 `strict` is **on by default**. You may still meet older projects, and older docs, where it is off, and you can opt out of individual checks. Two of those checks matter most.

## `noImplicitAny`

Where TypeScript can't work out a type it falls back to `any`, which turns off checking for that value. `noImplicitAny` makes that fallback an error, so nothing becomes `any` by accident:

```ts
function shout(text) { // ✗ Parameter 'text' implicitly has an 'any' type.
  return text.toUpperCase();
}
```

## `strictNullChecks`

Without this flag, `null` and `undefined` can be assigned to any type, and forgetting to handle them is a classic source of bugs. With it, you must deal with them explicitly:

```ts
function lengthOf(text: string | null) {
  return text.length; // ✗ 'text' is possibly 'null'.
}

function safeLengthOf(text: string | null) {
  return text === null ? 0 : text.length;
}
```

Every lesson and exercise in this course runs with `strict` enabled.

@quiz check
@q What does `noImplicitAny` report?
- [ ] Every use of the `any` type
- [x] Places where a type silently falls back to `any`
- [ ] Variables that are never used
@why You can still write `any` deliberately. The flag only rejects `any` that nobody asked for.
@q With `strictNullChecks` on, can you assign `null` to a variable of type `string`?
- [ ] Yes, `null` is valid for every type
- [x] No, the type would have to include `null`, such as `string | null`
@why The flag makes `null` and `undefined` distinct types that must be named and handled.
@end

@exercise fix-implicit-any | Satisfy noImplicitAny
Strict mode rejects this function because its parameters have no types. Annotate them so that `person` is a `string` and `date` is a `Date`.

```ts starter
function welcome(person, date) {
  return `Hello ${person}, today is ${date.toDateString()}!`;
}
```
```ts solution
function welcome(person: string, date: Date) {
  return `Hello ${person}, today is ${date.toDateString()}!`;
}
```
```ts check
// @test `person` is a string and `date` is a Date
type _welcomeParams = Expect<Equal<Parameters<typeof welcome>, [string, Date]>>;
// @test `welcome` still returns a string
type _welcomeReturn = Expect<Equal<ReturnType<typeof welcome>, string>>;
```
@hint Annotations go after the parameter name: `name: type`.
@end
