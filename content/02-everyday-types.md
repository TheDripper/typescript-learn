---
id: everyday-types
title: Everyday Types
summary: The types you'll write most of the time, from primitives and arrays to unions, aliases, interfaces and literals.
source: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
---

@lesson primitives | Primitives, arrays and any | 7

JavaScript's three most common primitives each have a matching type: `string`, `number` and `boolean`. Always use these lowercase names. `String`, `Number` and `Boolean` exist, but they refer to rarely used wrapper objects.

Arrays are written `number[]`, or equivalently `Array<number>`:

```ts
const scores: number[] = [90, 72, 85];
const names: Array<string> = ["Ada", "Grace"];
scores.push("100"); // ✗ A string can't go in a number[].
```

## `any` switches off checking

A value of type `any` can be used in every way, and the checker won't object:

```ts
let obj: any = { x: 0 };
obj.foo();
obj.bar = 100;
const n: number = obj;
```

That is occasionally useful, but none of those lines are checked, so any of them may crash.

## Annotating variables

You can annotate a declaration, but usually you shouldn't need to. TypeScript infers the type from the initializer:

```ts
let myName: string = "Alice"; // The annotation is redundant here.
let sameThing = "Alice";      // Still inferred as string.
```

@exercise annotate-values | Declare typed values
Give each declaration an explicit type annotation: `title` a string, `pages` a number, `tags` an array of strings. Then fix the value that doesn't match.

```ts starter
const title = "The Handbook";
const pages = "412";
const tags = ["docs", "typescript"];
```
```ts solution
const title: string = "The Handbook";
const pages: number = 412;
const tags: string[] = ["docs", "typescript"];
```
```ts check
// @test `title` is a string
type _title = Expect<Equal<typeof title, string>>;
// @test `pages` is a number
type _pages = Expect<Equal<typeof pages, number>>;
// @test `tags` is an array of strings
type _tags = Expect<Equal<typeof tags, string[]>>;
```
@hint A `const` without an annotation gets a narrower type like `"The Handbook"`. An annotation widens it.
@end

@quiz check
@q Which type should you use for a text value?
- [x] `string`
- [ ] `String`
- [ ] Either one, they mean the same thing
@why `String` refers to the wrapper object. Use the lowercase primitive types.
@q What does the checker do with `obj.anything()` when `obj` is `any`?
- [ ] Reports an error, since `anything` isn't declared
- [x] Accepts it without checking
- [ ] Inserts a runtime check
@why `any` turns off type-checking for that value, so mistakes are found only at runtime, if at all.
@end

@lesson functions-and-objects | Functions and object types | 8

Functions are the main way data moves through a program, so TypeScript lets you type what goes in and what comes out.

```ts
function getFavoriteNumber(label: string): number {
  return 26;
}

getFavoriteNumber(42); // ✗ Argument of type 'number' is not assignable to 'string'.
```

Return types are usually inferred, though some teams write them for documentation or to catch accidental changes. An `async` function returns a `Promise`:

```ts
async function getNumber(): Promise<number> {
  return 26;
}
```

## Contextual typing

When a function appears where its type can be determined, its parameters get types automatically. Here `name` is known to be a `string` from the array it belongs to:

```ts
const names = ["Alice", "Bob", "Eve"];
names.forEach((name) => console.log(name.toUpperCase()));
```

## Object types

List an object's properties and their types. Add `?` to make one optional. Reading an optional property may give you `undefined`, so check before you use it:

```ts
function printName(person: { first: string; last?: string }) {
  console.log(person.last.toUpperCase()); // ✗ 'person.last' is possibly 'undefined'.
  console.log(person.last?.toUpperCase());
}

printName({ first: "Bob" });
printName({ first: "Alice", last: "Alisson" });
```

@exercise point-distance | Type a function with an object parameter
Add types so that `distanceFromOrigin` takes an object with numeric `x` and `y` properties, plus an optional numeric `z`, and has an explicit `number` return type.

```ts starter
function distanceFromOrigin(point) {
  const z = point.z ?? 0;
  return Math.sqrt(point.x ** 2 + point.y ** 2 + z ** 2);
}
```
```ts solution
function distanceFromOrigin(point: { x: number; y: number; z?: number }): number {
  const z = point.z ?? 0;
  return Math.sqrt(point.x ** 2 + point.y ** 2 + z ** 2);
}
```
```ts check
// @test `z` can be left out
distanceFromOrigin({ x: 1, y: 2 });
// @test `z` can be given
distanceFromOrigin({ x: 1, y: 2, z: 3 });
// @test `x` is required
// @ts-expect-error
distanceFromOrigin({ y: 2 });
// @test the coordinates must be numbers
// @ts-expect-error
distanceFromOrigin({ x: "1", y: 2 });
// @test it returns a number
type _distanceReturn = Expect<Equal<ReturnType<typeof distanceFromOrigin>, number>>;
```
@hint Object types look like `{ a: number; b?: string }`.
@end

@lesson unions | Union types | 7

A **union** is a type formed from two or more others. A value may be any one of them:

```ts
function printId(id: number | string) {
  console.log(`Your ID is: ${id}`);
}

printId(101);
printId("202");
printId({ myId: 22342 }); // ✗ An object is neither a number nor a string.
```

## Working with a union

You may only do things that are valid for *every* member of the union:

```ts
function printId(id: number | string) {
  console.log(id.toUpperCase()); // ✗ 'toUpperCase' doesn't exist on number.
}
```

To use something specific to one member, **narrow** the union with a check that TypeScript understands:

```ts
function printId(id: number | string) {
  if (typeof id === "string") {
    console.log(id.toUpperCase());
  } else {
    console.log(id.toFixed(2));
  }
}
```

If every member has a method in common, you can call it with no narrowing. Both arrays and strings have `slice`, for example.

@quiz check
@q Given `x: string | number`, which is allowed without narrowing?
- [x] `x.toString()`
- [ ] `x.toUpperCase()`
- [ ] `x.toFixed(2)`
@why `toString` exists on both members of the union. The other two exist on only one.
@end

@exercise format-id | Handle both members of a union
`formatId` should accept a `number` or a `string`. Numbers must be padded with `toFixed(0)`, strings trimmed with `.trim()`. Add the union type and narrow it so that both branches type-check.

```ts starter
function formatId(id) {
  return id.trim();
}
```
```ts solution
function formatId(id: number | string): string {
  if (typeof id === "number") {
    return id.toFixed(0);
  }
  return id.trim();
}
```
```ts check
// @test it accepts numbers
formatId(7);
// @test it accepts strings
formatId(" a7 ");
// @test it rejects other types
// @ts-expect-error
formatId(true);
// @test it returns a string
type _formatReturn = Expect<Equal<ReturnType<typeof formatId>, string>>;
```
@hint Use `typeof id === "number"` to narrow.
@end

@lesson aliases-and-interfaces | Type aliases and interfaces | 8

A **type alias** gives a name to any type, so that you can reuse it. An alias is only a name: it doesn't create a distinct type.

```ts
type Point = { x: number; y: number };
type ID = number | string;

function printCoord(pt: Point) {
  console.log(pt.x, pt.y);
}
```

An **interface** is another way to name an object type:

```ts
interface Point {
  x: number;
  y: number;
}
```

TypeScript is a *structural* type system. It cares only about the shape of a value, so any object with a numeric `x` and `y` is a `Point`, whatever it is called.

## Which one should I use?

The two are almost interchangeable. The main differences are:

- A `type` can name anything, including unions and primitives. An `interface` only describes object shapes.
- An `interface` can be **reopened** to add fields. A `type` can't be changed once declared.

```ts
interface Window2 { title: string }
interface Window2 { size: number } // Both declarations merge.

type Box = { title: string };      // ✗ Duplicate identifier 'Box'.
type Box = { size: number };       // ✗ Duplicate identifier 'Box'.
```

Both can be extended: interfaces with `extends`, type aliases with intersections (`&`). A good default is to use `interface` until you need a feature of `type`.

@quiz check
@q Which can only be expressed with `type`, not with `interface`?
- [ ] An object with two properties
- [x] A name for `string | number`
- [ ] An object with an optional property
@why Interfaces only describe object shapes. Unions and primitives need a type alias.
@q What happens when you declare the same `interface` name twice in one scope?
- [ ] A compile error
- [x] The declarations merge into one interface
- [ ] The second one replaces the first
@why That is declaration merging, and interfaces support it. Type aliases don't, so a second `type` with the same name is an error.
@end

@exercise user-shape | Name a shape
Replace the repeated inline types. Declare an `interface User` with a string `name` and a numeric `age`, and a type alias `UserId` for `string | number`. Then use both in the function signature.

```ts starter
function findUser(id: string | number, users: { name: string; age: number }[]): { name: string; age: number } | undefined {
  return users.find((user, index) => index === id);
}
```
```ts solution
interface User {
  name: string;
  age: number;
}

type UserId = string | number;

function findUser(id: UserId, users: User[]): User | undefined {
  return users.find((user, index) => index === id);
}
```
```ts check
// @test `User` has a string name and a numeric age
type _userShape = Expect<Equal<User, { name: string; age: number }>>;
// @test `UserId` is string | number
type _userIdShape = Expect<Equal<UserId, string | number>>;
// @test `findUser` takes a UserId and a User list
type _findParams = Expect<Equal<Parameters<typeof findUser>, [UserId, User[]]>>;
// @test `findUser` returns a User or undefined
type _findReturn = Expect<Equal<ReturnType<typeof findUser>, User | undefined>>;
```
@hint Interfaces use `interface User { ... }`. Aliases use `type UserId = ...;`.
@end

@lesson assertions-and-literals | Type assertions and literal types | 8

## Type assertions

Sometimes you know more than the checker does. An assertion says "treat this as a more specific type":

```ts
const canvas = document.getElementById("main") as HTMLCanvasElement;
```

Assertions are erased at compile time, so no runtime check happens. If you are wrong, nothing warns you. TypeScript only allows assertions that could plausibly be true, going to a more or a less specific type:

```ts
const x = "hello" as number; // ✗ Neither type sufficiently overlaps the other.
```

## Literal types

A specific string or number can itself be a type. `let` variables widen to the general type. `const` variables keep the exact value:

```ts
let changing = "Hello"; // string
const constant = "Hello"; // "Hello"
```

Literals become useful when combined in unions, where they describe a fixed set of allowed values:

```ts
function align(text: string, side: "left" | "right" | "center") {}

align("Hello", "left");
align("Hello", "centre"); // ✗ "centre" isn't one of the allowed values.
```

## Literal inference

Object properties are inferred as general types, since they could be changed later. That can surprise you:

```ts
declare function request(url: string, method: "GET" | "POST"): void;

const req = { url: "https://example.com", method: "GET" };
request(req.url, req.method); // ✗ 'req.method' is a string, not "GET" | "POST".
```

`as const` fixes this by converting the whole object to its literal, `readonly` form:

```ts
declare function request(url: string, method: "GET" | "POST"): void;

const req = { url: "https://example.com", method: "GET" } as const;
request(req.url, req.method);
```

@quiz check
@q What does `value as Foo` do at runtime?
- [ ] Throws if `value` isn't a `Foo`
- [ ] Converts `value` to a `Foo`
- [x] Nothing, the assertion is erased
@why Assertions only influence the checker. A wrong one will fail later, somewhere less obvious.
@q What is the type of `s` in `let s = "hi"`?
- [x] `string`
- [ ] `"hi"`
- [ ] `any`
@why `let` can be reassigned, so its type widens to `string`. A `const` would keep `"hi"`.
@end

@exercise literal-method | Keep a literal
`send` only accepts specific verbs, but `options.verb` is inferred as `string`. Without changing `send`, fix the `options` declaration so that the call compiles.

```ts starter
declare function send(path: string, verb: "GET" | "PUT"): void;

const options = { path: "/users", verb: "GET" };
send(options.path, options.verb);
```
```ts solution
declare function send(path: string, verb: "GET" | "PUT"): void;

const options = { path: "/users", verb: "GET" } as const;
send(options.path, options.verb);
```
```ts check
// @test `options.verb` is the literal "GET"
type _verb = Expect<Equal<typeof options.verb, "GET">>;
```
@hint One short suffix on the object literal will do it.
@end

@lesson null-and-rare-primitives | null, undefined and rarer primitives | 7

With `strictNullChecks` on, a value that might be `null` or `undefined` has to be tested before you use it:

```ts
function doSomething(x: string | null) {
  if (x === null) {
    return;
  }
  console.log("Hello, " + x.toUpperCase());
}
```

## The non-null assertion

A postfix `!` tells the checker a value isn't `null` or `undefined`. Like other assertions it does nothing at runtime, so only use it when you are certain:

```ts
function liveDangerously(x?: number | null) {
  console.log(x!.toFixed());
}
```

## Enums

Enums are a TypeScript feature that adds a real object at runtime, unlike most type-level syntax. They have their own reference page. Many codebases prefer a union of literals instead.

## `bigint` and `symbol`

`bigint` holds arbitrarily large integers, and `symbol` holds globally unique references. Each value from `Symbol()` is unique, and TypeScript knows that:

```ts
const huge: bigint = 100n;

const first = Symbol("name");
const second = Symbol("name");

if (first === second) { // ✗ These two symbols can never be equal.
  // ...
}
```

@quiz check
@q What does the postfix `!` in `x!.toFixed()` do at runtime?
- [x] Nothing, it only tells the checker that `x` isn't null or undefined
- [ ] Throws an error if `x` is null
- [ ] Converts `x` to a number
@why It is erased like any other type-level syntax. If `x` really is null, the call will crash.
@q Which of these features emits real JavaScript objects?
- [x] `enum`
- [ ] `interface`
- [ ] `type` alias
@why Interfaces and aliases are erased completely, whereas an enum exists at runtime.
@end

@exercise null-safe | Handle a missing value
`initials` may receive `null`. Annotate the parameter as `string | null`, and return an empty string when it's `null`, without using `!`.

```ts starter
function initials(name) {
  return name.slice(0, 2).toUpperCase();
}
```
```ts solution
function initials(name: string | null): string {
  if (name === null) {
    return "";
  }
  return name.slice(0, 2).toUpperCase();
}
```
```ts check
// @test it accepts a string
initials("Ada");
// @test it accepts null
initials(null);
// @test it rejects undefined
// @ts-expect-error
initials(undefined);
// @test it always returns a string
type _initialsReturn = Expect<Equal<ReturnType<typeof initials>, string>>;
```
@hint Return early with `""` if `name === null`.
@end
