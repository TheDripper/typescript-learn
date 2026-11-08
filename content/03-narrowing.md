---
id: narrowing
title: Narrowing
summary: How TypeScript follows your runtime checks to refine a broad type into a precise one.
source: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
---

@lesson type-guards | Type guards | 9

TypeScript follows the possible paths through your code and refines a value's type wherever a check proves something about it. This is **narrowing**, and the checks are **type guards**.

## `typeof`

`typeof` returns one of a fixed set of strings: `"string"`, `"number"`, `"bigint"`, `"boolean"`, `"symbol"`, `"undefined"`, `"object"` and `"function"`. Remember that `typeof null` is `"object"`, which is a historic JavaScript quirk that the checker models:

```ts
function printAll(strs: string | string[] | null) {
  if (typeof strs === "object") {
    for (const s of strs) { // ✗ 'strs' is possibly 'null'.
      console.log(s);
    }
  }
}
```

## Truthiness

Conditions, `&&`, `||` and `!` all narrow. Be careful with falsy values such as `0` and `""`. A truthiness check on a string also excludes the empty string, which may not be what you meant.

```ts
function printAll(strs: string | string[] | null) {
  if (strs && typeof strs === "object") {
    for (const s of strs) {
      console.log(s);
    }
  }
}
```

## Equality

Comparing with `===`, `!==`, `==` or `!=` narrows both sides. A handy idiom: `x != null` removes both `null` and `undefined`.

```ts
function example(x: string | number, y: string | boolean) {
  if (x === y) {
    x.toUpperCase(); // Both must be string here.
    y.toLowerCase();
  }
}
```

## `in`

`"swim" in animal` narrows to the union members that have, or may have, that property:

```ts
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    return animal.swim();
  }
  return animal.fly();
}
```

## `instanceof`

`x instanceof Foo` checks the prototype chain, and narrows to `Foo` when the check succeeds:

```ts
function logValue(x: Date | string) {
  if (x instanceof Date) {
    console.log(x.toUTCString());
  } else {
    console.log(x.toUpperCase());
  }
}
```

@quiz check
@q Inside `if (typeof x === "object")`, why might `x` still be `null`?
- [x] Because `typeof null` is `"object"` in JavaScript
- [ ] Because `typeof` doesn't narrow objects
- [ ] It can't be, this is a trick question
@why It's a long-standing JavaScript quirk, and TypeScript models it accurately.
@q Which values does `if (x != null)` exclude?
- [ ] Only `null`
- [x] Both `null` and `undefined`
- [ ] `null`, `undefined`, `0` and `""`
@why Loose equality with `null` matches `undefined` as well, and nothing else.
@end

@exercise pad-left | Narrow with typeof
`padLeft` takes a `padding` that's either a number of spaces or a literal string. Add the parameter types and narrow `padding` so that this compiles. For numbers use `" ".repeat(padding) + input`, and for strings use `padding + input`.

```ts starter
function padLeft(padding, input) {
  return " ".repeat(padding) + input;
}
```
```ts solution
function padLeft(padding: number | string, input: string): string {
  if (typeof padding === "number") {
    return " ".repeat(padding) + input;
  }
  return padding + input;
}
```
```ts check
// @test `padding` can be a number
padLeft(4, "x");
// @test `padding` can be a string
padLeft("--", "x");
// @test `padding` can't be a boolean
// @ts-expect-error
padLeft(true, "x");
// @test `input` must be a string
// @ts-expect-error
padLeft(1, 2);
```
@hint The `.repeat` call is only valid in a branch where `padding` is a `number`.
@end

@lesson control-flow | Control flow and type predicates | 9

## Control flow analysis

Narrowing is more than `if` statements. TypeScript analyzes every branch and tracks each variable's type at each point. After an assignment, the variable narrows to the assigned type, still limited by what it was declared as:

```ts
let x = Math.random() < 0.5 ? 10 : "hello world!";
x = 1;
console.log(x.toFixed());
x = "goodbye!";
x = true; // ✗ boolean isn't part of the declared type string | number.
```

Early returns count as well: after `if (typeof x === "string") return;`, the rest of the function knows that `x` isn't a string.

## Writing your own type guards

When the built-in checks aren't enough, write a function whose return type is a **type predicate** of the form `param is Type`:

```ts
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function isFish(pet: Fish | Bird): pet is Fish {
  return (pet as Fish).swim !== undefined;
}

function move(pet: Fish | Bird) {
  if (isFish(pet)) {
    pet.swim();
  } else {
    pet.fly();
  }
}
```

TypeScript trusts your predicate. If the body is wrong, the checker won't notice. Predicates also work with `filter`:

```ts
type Fish = { swim: () => void };
type Bird = { fly: () => void };
declare function isFish(pet: Fish | Bird): pet is Fish;
declare const zoo: (Fish | Bird)[];

const fishes: Fish[] = zoo.filter(isFish);
```

## Assertion functions

An `asserts` signature narrows by throwing instead of returning a boolean. If the call returns, the condition must have held:

```ts
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Not a string");
  }
}

function shout(value: unknown) {
  assertIsString(value);
  return value.toUpperCase();
}
```

@quiz check
@q Does TypeScript verify that the body of a type predicate is correct?
- [ ] Yes, it proves that the return value matches
- [x] No, it trusts the signature
@why A predicate is a promise made by you. The body only has to return a boolean.
@q After `let x: string | number = 1`, what is the type of `x` on the next line?
- [ ] `string | number`
- [x] `number`
- [ ] `1`
@why Assignment narrows to the assigned type. The declared type still limits what can be assigned later.
@end

@exercise is-string-array | Write a type predicate
Write `isStringArray` so that it narrows `unknown` to `string[]`. Its return type must be a type predicate. Check `Array.isArray(value)`, and that every element is a string.

```ts starter
function isStringArray(value: unknown) {
  return false;
}

function joinAll(value: unknown): string {
  if (isStringArray(value)) {
    return value.join(",");
  }
  return "";
}
```
```ts solution
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function joinAll(value: unknown): string {
  if (isStringArray(value)) {
    return value.join(",");
  }
  return "";
}
```
```ts check
declare const _unknownValue: unknown;
// @test `isStringArray` narrows its argument to string[]
if (isStringArray(_unknownValue)) {
  type _narrowed = Expect<Equal<typeof _unknownValue, string[]>>;
} else {
  _unknownValue;
}
```
@hint The return type looks like `value is string[]`.
@end

@lesson discriminated-unions | Discriminated unions and exhaustiveness | 9

Optional properties are a poor way to model "one of several shapes":

```ts
interface Shape {
  kind: "circle" | "square";
  radius?: number;
  sideLength?: number;
}
```

Nothing stops a circle from lacking a `radius`. Instead, give each shape its own type, with a literal **discriminant** property in common:

```ts
interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  sideLength: number;
}

type Shape = Circle | Square;

function getArea(shape: Shape) {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.sideLength ** 2;
  }
}
```

Checking `kind` narrows the whole object, so each branch sees only the properties that are really there.

## `never` and exhaustiveness

When every possibility has been ruled out, a value has type `never`. Nothing is assignable to `never` other than `never` itself, and that makes for a neat safety net:

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number }
  | { kind: "triangle"; base: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.side ** 2;
    default:
      const unhandled: never = shape; // ✗ The triangle case isn't handled.
      return unhandled;
  }
}
```

Add a new member to the union, and every `switch` that doesn't handle it becomes a compile error.

@quiz check
@q What makes a property a good discriminant?
- [x] Every union member has it, and it has a different literal type in each
- [ ] It is optional on every member
- [ ] It is declared `readonly`
@why Checking a shared literal property tells TypeScript exactly which member you have.
@q In a `switch` over a union, what is the type of the value in `default` when all cases are handled?
- [ ] `unknown`
- [ ] `any`
- [x] `never`
@why Nothing remains, so the type is `never`.
@end

@exercise exhaustive-events | Model states with a discriminated union
Replace the loose `Result` interface with a discriminated union, `status` being the discriminant. A success has a string `data`. A failure has a numeric `code`. Make `describe` handle both so that it compiles.

```ts starter
interface Result {
  status: string;
  data?: string;
  code?: number;
}

function describe(result: Result): string {
  if (result.status === "success") {
    return result.data.toUpperCase();
  }
  return result.code.toFixed(0);
}
```
```ts solution
type Result =
  | { status: "success"; data: string }
  | { status: "failure"; code: number };

function describe(result: Result): string {
  if (result.status === "success") {
    return result.data.toUpperCase();
  }
  return result.code.toFixed(0);
}
```
```ts check
// @test a success with `data` is valid
const _ok: Result = { status: "success", data: "hi" };
// @test a failure with `code` is valid
const _bad: Result = { status: "failure", code: 500 };
// @test a success must have `data`
// @ts-expect-error
const _noData: Result = { status: "success" };
// @test a failure must have `code`
// @ts-expect-error
const _noCode: Result = { status: "failure" };
// @test `status` only allows the two states
// @ts-expect-error
const _other: Result = { status: "pending", data: "x" };
```
@hint Use the literal types `"success"` and `"failure"` for `status`, one in each union member.
@end
