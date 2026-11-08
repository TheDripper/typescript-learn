---
id: functions
title: More on Functions
summary: Function types, generics, overloads and the special types that matter around functions.
source: https://www.typescriptlang.org/docs/handbook/2/functions.html
---

@lesson function-types | Function types | 6

A **function type expression** describes a function with arrow-like syntax. Parameter names are required:

```ts
type GreetFunction = (name: string) => void;

function greeter(fn: GreetFunction) {
  fn("Hello, World");
}
```

## Call signatures

Functions in JavaScript can also carry properties. A **call signature** inside an object type describes both. Note that it uses `:` where a function type expression uses `=>`:

```ts
type DescribableFunction = {
  description: string;
  (someArg: number): boolean;
};

function doSomething(fn: DescribableFunction) {
  console.log(fn.description + " returned " + fn(6));
}
```

## Construct signatures

Functions invoked with `new` are described by adding `new` in front:

```ts
type Thing = { label: string };
type ThingConstructor = {
  new (label: string): Thing;
};

function make(ctor: ThingConstructor) {
  return new ctor("hello");
}
```

@exercise function-type | Write a function type
Declare a type alias `Comparator` for a function that takes two `number` parameters and returns a `number`. Then use it for the second parameter of `sortNumbers`.

```ts starter
function sortNumbers(values: number[], compare) {
  return [...values].sort(compare);
}
```
```ts solution
type Comparator = (a: number, b: number) => number;

function sortNumbers(values: number[], compare: Comparator) {
  return [...values].sort(compare);
}
```
```ts check
// @test `Comparator` takes two numbers and returns a number
type _comparator = Expect<Equal<Comparator, (a: number, b: number) => number>>;
// @test `sortNumbers` takes a Comparator
type _sortParams = Expect<Equal<Parameters<typeof sortNumbers>[1], Comparator>>;
```
@hint A function type expression looks like `(a: X) => Y`.
@end

@lesson generic-functions | Generic functions | 10

Often the output type of a function relates to its input type. `any` loses that relationship. A **type parameter** keeps it:

```ts
function firstElement<Type>(arr: Type[]): Type | undefined {
  return arr[0];
}

const s = firstElement(["a", "b", "c"]); // string | undefined
const n = firstElement([1, 2, 3]);       // number | undefined
```

TypeScript **inferred** `Type` from the argument. You can use several type parameters too:

```ts
function map<Input, Output>(arr: Input[], func: (arg: Input) => Output): Output[] {
  return arr.map(func);
}

const parsed = map(["1", "2"], (n) => parseInt(n));
```

## Constraints

Use `extends` to require something of a type parameter:

```ts
function longest<Type extends { length: number }>(a: Type, b: Type) {
  return a.length >= b.length ? a : b;
}

const arr = longest([1, 2], [1, 2, 3]);
const str = longest("alice", "bob");
const bad = longest(10, 100); // ✗ number has no 'length' property.
```

A common mistake is to return something that merely satisfies the constraint. A generic function must return the same `Type` the caller chose, not just some object that looks similar.

## Guidelines for good generics

1. **Push type parameters down.** Prefer `arr: T[]` to `arr: T extends any[]`, so that return types resolve to something useful.
2. **Use fewer type parameters.** Each one should relate at least two values.
3. **Type parameters should appear twice.** If one appears only once, you probably don't need it.

```ts
function greetBad<Str extends string>(s: Str) { // Str only appears once.
  console.log("Hello, " + s);
}

function greetGood(s: string) {
  console.log("Hello, " + s);
}
```

@quiz check
@q What is the main reason to use a type parameter instead of `any`?
- [ ] It runs faster
- [x] It preserves the relationship between input and output types
- [ ] It's required for all functions that take arrays
@why With `any` the return type tells callers nothing. A type parameter carries the caller's type through.
@q A type parameter appears only once in a signature. What should you do?
- [ ] Add a second one to balance it
- [x] Consider removing it and using a concrete type
- [ ] Make it extend `any`
@why A type parameter exists to relate values. If it's used once, it relates nothing.
@end

@exercise generic-last | Write a generic function
Make `last` generic, so that it returns the array's element type or `undefined`.

```ts starter
function last(items: any[]): any {
  return items[items.length - 1];
}
```
```ts solution
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}
```
```ts check
const _lastNumber = last([1, 2, 3]);
const _lastString = last(["a"]);
// @test it preserves number
type _ln = Expect<Equal<typeof _lastNumber, number | undefined>>;
// @test it preserves string
type _ls = Expect<Equal<typeof _lastString, string | undefined>>;
```
@hint Declare the type parameter after the name: `function last<T>(...)`.
@end

@lesson optional-and-overloads | Optional parameters and overloads | 9

Mark a parameter optional with `?`, or give it a default. An optional parameter has `undefined` in its type:

```ts
function f(x?: number) {
  x?.toFixed();
}

function g(x = 10) {
  x.toFixed();
}
```

**Don't write optional parameters in callback types** unless you intend to call the callback without that argument. A callback's author has to handle every parameter that you marked as possibly missing.

## Overloads

Sometimes a function can be called in several distinct ways. Write **overload signatures** first, followed by one implementation:

```ts
function makeDate(timestamp: number): Date;
function makeDate(month: number, day: number, year: number): Date;
function makeDate(monthOrTimestamp: number, day?: number, year?: number): Date {
  if (day !== undefined && year !== undefined) {
    return new Date(year, monthOrTimestamp, day);
  }
  return new Date(monthOrTimestamp);
}

makeDate(12345678);
makeDate(5, 5, 5);
makeDate(1, 3); // ✗ There's no overload with two arguments.
```

The implementation signature **isn't visible** from outside. Callers can use only the overloads above it.

## Prefer unions when you can

Overloads are resolved one at a time, so a union-typed argument can't match an overload that takes only one member. When the return type doesn't vary, a union parameter is simpler and more flexible:

```ts
function len(x: any[] | string) {
  return x.length;
}
```

@quiz check
@q Can a caller use the implementation signature of an overloaded function directly?
- [ ] Yes, it's just one more overload
- [x] No, only the overload signatures are visible
@why The implementation has to be compatible with the overloads, but it is hidden from callers.
@q What is the type of `x` inside `function f(x?: number)`?
- [ ] `number`
- [x] `number | undefined`
- [ ] `any`
@why An omitted optional parameter is `undefined`, so the type includes it.
@end

@exercise overload-parse | Write overloads
Add two overload signatures to `parse`, so a `string` input returns a `number`, and a `number` input returns a `string`. Keep one implementation, using a union.

```ts starter
function parse(value: any): any {
  return typeof value === "string" ? Number(value) : String(value);
}
```
```ts solution
function parse(value: string): number;
function parse(value: number): string;
function parse(value: string | number): string | number {
  return typeof value === "string" ? Number(value) : String(value);
}
```
```ts check
const _parsedNumber = parse("42");
const _parsedString = parse(42);
// @test a string input returns a number
type _pn = Expect<Equal<typeof _parsedNumber, number>>;
// @test a number input returns a string
type _ps = Expect<Equal<typeof _parsedString, string>>;
// @test other inputs are rejected
// @ts-expect-error
parse(true);
```
@hint Signatures with no body come directly before the implementation.
@end

@lesson other-types | void, unknown, never, rest and this | 9

## Types that matter around functions

- `void` means a function doesn't return a useful value. It isn't the same as `undefined`.
- `object` is any non-primitive value. It isn't `Object`, and isn't `{}`.
- `unknown` is the safe counterpart of `any`. Anything can be assigned to it, but you must narrow before doing anything with it.
- `never` is the type of values that can never exist, such as the return of a function that always throws.
- `Function` describes any function, and calling it returns `any`. Prefer a specific signature.

```ts
function safeParse(s: string): unknown {
  return JSON.parse(s);
}

const value = safeParse("1");
value.toFixed(); // ✗ 'value' is of type 'unknown'.

function fail(msg: string): never {
  throw new Error(msg);
}
```

## Rest parameters and arguments

A rest parameter collects extra arguments, and its type must be an array or a tuple. Spreading works in the other direction, and `as const` helps when the callee expects a fixed number of arguments:

```ts
function multiply(n: number, ...m: number[]) {
  return m.map((x) => n * x);
}

const args = [8, 5] as const;
const angle = Math.atan2(...args);
```

## Parameter destructuring

Annotations for a destructured parameter go after the whole pattern:

```ts
function sum({ a, b, c }: { a: number; b: number; c: number }) {
  console.log(a + b + c);
}
```

## Declaring `this`

A function can declare the type of `this` as a fake first parameter, which is erased from the output. This must be a `function`, since arrow functions capture the outer `this`:

```ts
interface User { admin: boolean }
interface DB {
  filterUsers(filter: (this: User) => boolean): User[];
}
declare const db: DB;

const admins = db.filterUsers(function (this: User) {
  return this.admin;
});
```

## `void` callbacks

A contextual `() => void` type doesn't force the function to return nothing. Its return value is simply ignored. That is why `push`, which returns a number, works happily in `forEach`:

```ts
const source = [1, 2, 3];
const target: number[] = [];
source.forEach((n) => target.push(n));
```

@quiz check
@q What's the main difference between `unknown` and `any`?
- [x] You can't do anything with an `unknown` value until you narrow it
- [ ] `unknown` can only hold primitive values
- [ ] `any` can't be assigned to anything
@why Both accept any value, but `unknown` keeps checking turned on.
@q What return type fits a function that always throws?
- [ ] `void`
- [ ] `undefined`
- [x] `never`
@why The function never returns at all, so no return value can exist.
@q Can you pass a function that returns a number to a parameter of type `() => void`?
- [x] Yes, the return value is ignored
- [ ] No, it must return nothing
@why Contextual `void` return types don't require the function to return nothing.
@end

@exercise unknown-json | Use unknown safely
`readCount` should accept an `unknown` value and return it if it's a number, or `0` otherwise. Replace `any`.

```ts starter
function readCount(value: any): any {
  return value;
}
```
```ts solution
function readCount(value: unknown): number {
  return typeof value === "number" ? value : 0;
}
```
```ts check
// @test the parameter is unknown
type _rcParams = Expect<Equal<Parameters<typeof readCount>, [unknown]>>;
// @test it returns a number
type _rcReturn = Expect<Equal<ReturnType<typeof readCount>, number>>;
```
@hint You have to narrow with `typeof` before you can return it as a number.
@end
