---
id: type-manipulation
title: Type Manipulation
summary: Building types from other types with generics, keyof, typeof, indexed access, conditional, mapped and template literal types.
source: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html
---

@lesson generics | Generics in depth | 10

TypeScript's type system lets you express new types in terms of existing ones. Generics are the foundation.

The generic *identity* function returns what it's given, without losing type information:

```ts
function identity<Type>(arg: Type): Type {
  return arg;
}

const a = identity<string>("explicit");
const b = identity("inferred");
```

Inside a generic function you can only use what's true of *all* types, so you have to treat `Type` as if it could be anything:

```ts
function loggingIdentity<Type>(arg: Type): Type {
  console.log(arg.length); // ✗ Type 'Type' has no 'length'.
  return arg;
}
```

## Generic types

Generic functions have a type, and you can make whole interfaces and classes generic too:

```ts
interface GenericIdentityFn<Type> {
  (arg: Type): Type;
}

function identity<Type>(arg: Type): Type {
  return arg;
}

const myIdentity: GenericIdentityFn<number> = identity;
```

## Constraints with other parameters

A type parameter can be constrained by another one. Here `Key` must be a real key of `Type`:

```ts
function getProperty<Type, Key extends keyof Type>(obj: Type, key: Key) {
  return obj[key];
}

const x = { a: 1, b: 2, c: 3 };
getProperty(x, "a");
getProperty(x, "m"); // ✗ "m" isn't a key of x.
```

## Defaults

Type parameters can have defaults, which makes them optional. Required parameters can't follow optional ones:

```ts
interface Response2<Data = string, Err = Error> {
  data?: Data;
  error?: Err;
}

const simple: Response2 = { data: "ok" };
const typed: Response2<number> = { data: 42 };
```

## Variance annotations

`in` and `out` on a type parameter declare how it relates to subtyping. They are advanced, and only needed in rare cases, since TypeScript normally works out variance on its own.

@quiz check
@q Why is `arg.length` an error when `arg` has an unconstrained type parameter?
- [x] The caller might pass a type with no `length`
- [ ] Type parameters can't have properties
- [ ] Only arrays can be generic
@why A generic body must work for every possible type. Add a constraint to require `length`.
@end

@exercise pluck | Constrain with keyof
Make `pluck` generic, so that the `key` must be a key of the item type, and the return type is an array of that property's type.

```ts starter
function pluck(items: any[], key: string): any[] {
  return items.map((item) => item[key]);
}
```
```ts solution
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}
```
```ts check
const _people = [{ name: "Ada", age: 36 }];
const _names = pluck(_people, "name");
const _ages = pluck(_people, "age");
// @test plucking `name` gives string[]
type _pluckNames = Expect<Equal<typeof _names, string[]>>;
// @test plucking `age` gives number[]
type _pluckAges = Expect<Equal<typeof _ages, number[]>>;
// @test unknown keys are rejected
// @ts-expect-error
pluck(_people, "email");
```
@hint Use two type parameters. The return type uses an indexed access, `T[K]`.
@end

@lesson keyof-typeof-indexed | keyof, typeof and indexed access | 8

## `keyof`

`keyof` produces a union of an object type's keys:

```ts
type Point = { x: number; y: number };
type P = keyof Point; // "x" | "y"

type Arrayish = { [n: number]: unknown };
type A = keyof Arrayish; // number
```

For a `[key: string]` index signature you get `string | number`, because JavaScript converts numeric keys to strings.

## `typeof` in type positions

TypeScript adds a type-level `typeof`, which gets the type of a *value*. It's most useful combined with other operators. It only works on identifiers and their properties:

```ts
function f() {
  return { x: 10, y: 3 };
}

type P = ReturnType<typeof f>; // { x: number; y: number }

let shouldContinue: typeof f();  // ✗ You can't apply typeof to a call.
```

## Indexed access types

Look up the type of a property using bracket syntax. The index is itself a type, so you can use unions:

```ts
type Person = { age: number; name: string; alive: boolean };

type Age = Person["age"]; // number
type NameOrAlive = Person["name" | "alive"]; // string | boolean
type AnyValue = Person[keyof Person];

type Nope = Person["email"]; // ✗ 'email' doesn't exist on Person.
```

`number` as an index gets an array's element type. Together with `typeof`, that is a common way to derive a type from data:

```ts
const roles = ["admin", "editor", "guest"] as const;

type Role = (typeof roles)[number]; // "admin" | "editor" | "guest"
```

Only types can be used in an index. A `const` variable won't work, but `typeof` that variable, or a type alias, will.

@quiz check
@q What does `keyof { a: 1; b: 2 }` produce?
- [ ] `1 | 2`
- [x] `"a" | "b"`
- [ ] `string`
@why `keyof` gives the keys. `T[keyof T]` would give the values.
@q Given `const list = [1, "a"]`, what is `(typeof list)[number]`?
- [x] `string | number`
- [ ] `number`
- [ ] `0 | 1`
@why Indexing an array type by `number` gives its element type.
@end

@exercise derive-from-data | Derive types from a value
Without writing out the literals by hand, make `Status` a union of the values in `STATUSES`, and make `Limits` the type of the `LIMITS` object. You'll need to adjust `STATUSES` so its literal values are preserved.

```ts starter
const STATUSES = ["open", "closed", "merged"];

const LIMITS = { title: 80, body: 5000 };

type Status = string;
type Limits = unknown;
```
```ts solution
const STATUSES = ["open", "closed", "merged"] as const;

const LIMITS = { title: 80, body: 5000 };

type Status = (typeof STATUSES)[number];
type Limits = typeof LIMITS;
```
```ts check
// @test `Status` is the union of the three strings
type _status = Expect<Equal<Status, "open" | "closed" | "merged">>;
// @test `Limits` matches the object
type _limits = Expect<Equal<Limits, { title: number; body: number }>>;
```
@hint Add `as const` to the array, then index its type with `[number]`.
@end

@lesson conditional-types | Conditional types | 9

A conditional type chooses between two types, based on a relationship. It reads like a ternary:

```ts
interface Animal { live(): void }
interface Dog extends Animal { woof(): void }

type Example1 = Dog extends Animal ? number : string; // number
```

They are most useful with generics:

```ts
type NameOrId<T extends number | string> = T extends number ? { id: T } : { name: T };

type A = NameOrId<string>; // { name: string }
type B = NameOrId<number>; // { id: number }
```

## Inferring with `infer`

Within the `extends` clause, `infer` introduces a new type variable and captures part of the matched type:

```ts
type Flatten<T> = T extends Array<infer Item> ? Item : T;

type Str = Flatten<string[]>; // string
type Num = Flatten<number>;   // number

type GetReturn<T> = T extends (...args: never[]) => infer R ? R : never;
type N = GetReturn<() => number>; // number
```

## Distributive conditional types

When the checked type is a bare type parameter, and you pass a union, the conditional is applied to **each member separately**:

```ts
type ToArray<T> = T extends any ? T[] : never;

type Separate = ToArray<string | number>; // string[] | number[]
```

To turn off that behavior, wrap both sides of `extends` in square brackets:

```ts
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;

type Together = ToArrayNonDist<string | number>; // (string | number)[]
```

@quiz check
@q What is `ToArray<string | number>` when `type ToArray<T> = T extends any ? T[] : never`?
- [x] `string[] | number[]`
- [ ] `(string | number)[]`
- [ ] `never`
@why The conditional distributes over a union when the checked type is a bare type parameter.
@q What does `infer` do?
- [ ] Forces a function's return type to be inferred
- [x] Declares a type variable, captured from the matched type, within a conditional
- [ ] Turns on inference for a whole file
@why `infer` is valid only in the `extends` clause of a conditional type.
@end

@exercise unwrap | Extract with infer
Write `Unwrap<T>`. If `T` is a `Promise` of something, it gives that inner type, otherwise it gives `T`. Don't use the built-in `Awaited`.

```ts starter
type Unwrap<T> = T;
```
```ts solution
type Unwrap<T> = T extends Promise<infer Inner> ? Inner : T;
```
```ts check
// @test unwraps Promise<string>
type _u1 = Expect<Equal<Unwrap<Promise<string>>, string>>;
// @test leaves number alone
type _u2 = Expect<Equal<Unwrap<number>, number>>;
// @test unwraps one level at a time
type _u3 = Expect<Equal<Unwrap<Promise<Promise<number>>>, Promise<number>>>;
```
@hint Follow the pattern `T extends Something<infer X> ? X : T`.
@end

@lesson mapped-types | Mapped types | 8

A **mapped type** builds a new object type by iterating over a union of keys, usually from `keyof`:

```ts
type OptionsFlags<Type> = {
  [Property in keyof Type]: boolean;
};

type Features = { darkMode: () => void; newProfile: () => void };
type FeatureFlags = OptionsFlags<Features>;
// { darkMode: boolean; newProfile: boolean }
```

## Modifiers

Add or remove `readonly` and `?` with a `+` or `-` prefix. A plain modifier means `+`:

```ts
type CreateMutable<Type> = {
  -readonly [Property in keyof Type]: Type[Property];
};

type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property];
};

type Maybe = { id: string; name?: string };
type Full = Concrete<Maybe>; // { id: string; name: string }
```

## Remapping keys with `as`

An `as` clause computes a new key, often with a template literal type. Mapping a key to `never` filters it out:

```ts
type Getters<Type> = {
  [Property in keyof Type as `get${Capitalize<string & Property>}`]: () => Type[Property];
};

type RemoveKind<Type> = {
  [Property in keyof Type as Exclude<Property, "kind">]: Type[Property];
};

interface Circle { kind: "circle"; radius: number }
type KindlessCircle = RemoveKind<Circle>; // { radius: number }
```

@quiz check
@q What does `-?` do in a mapped type?
- [ ] Makes every property optional
- [x] Removes optionality, so every property is required
- [ ] Deletes optional properties
@why `-` removes a modifier, and `?` is the optional modifier. The property stays, but is required.
@q How do you drop a key using a mapped type?
- [x] Remap it to `never` with `as`
- [ ] Set its value type to `never`
- [ ] Use `delete` in the type
@why Keys remapped to `never` are left out of the result. A value of `never` would keep the key.
@end

@exercise my-partial | Write mapped types
Write `MyPartial<T>`, which makes every property optional, and `ReadonlyNumbers<T>`, which keeps only the keys whose value type is `number`, and makes them `readonly`. Don't use the built-in utility types.

```ts starter
type MyPartial<T> = T;
type ReadonlyNumbers<T> = T;
```
```ts solution
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};
type ReadonlyNumbers<T> = {
  readonly [K in keyof T as T[K] extends number ? K : never]: T[K];
};
```
```ts check
type _Sample = { a: number; b: string; c: number };
// @test `MyPartial` makes properties optional
type _mp = Expect<Equal<MyPartial<_Sample>, { a?: number; b?: string; c?: number }>>;
// @test `ReadonlyNumbers` keeps only number properties, read-only
type _rn = Expect<Equal<ReadonlyNumbers<_Sample>, { readonly a: number; readonly c: number }>>;
```
@hint For the second one, use `as T[K] extends number ? K : never`.
@end

@lesson template-literal-types | Template literal types | 7

Template literal types use the same syntax as JavaScript template strings, but in type positions. Unions in the placeholders expand to every combination:

```ts
type Lang = "en" | "ja";
type Section = "header" | "footer";

type Id = `${Lang}_${Section}_id`;
// "en_header_id" | "en_footer_id" | "ja_header_id" | "ja_footer_id"
```

## Inference from strings

This lets an API derive names from data. Here the callback knows the type of the value from the property name in the event:

```ts
type PropEventSource<Type> = {
  on<Key extends string & keyof Type>(
    eventName: `${Key}Changed`,
    callback: (newValue: Type[Key]) => void,
  ): void;
};

declare function makeWatched<Type>(obj: Type): Type & PropEventSource<Type>;

const person = makeWatched({ firstName: "Saoirse", age: 26 });

person.on("firstNameChanged", (value) => console.log(value.toUpperCase()));
person.on("ageChanged", (value) => console.log(value.toFixed()));
person.on("firstName", () => {}); // ✗ Not an allowed event name.
```

## Intrinsic string types

TypeScript has four string-manipulating types built in: `Uppercase`, `Lowercase`, `Capitalize` and `Uncapitalize`.

```ts
type Greeting = "hello";
type Loud = Uppercase<Greeting>; // "HELLO"
type Title = Capitalize<Greeting>; // "Hello"
```

@quiz check
@q How many members does `` `${"a" | "b"}-${"x" | "y" | "z"}` `` have?
- [ ] 2
- [ ] 5
- [x] 6
@why Each placeholder's union multiplies the result: 2 × 3 = 6.
@end

@exercise css-vars | Compute string types
Using template literal types, define `Size` so it's `"sm-px" | "sm-rem" | "lg-px" | "lg-rem"`, built from the given `Base` and `Unit` unions. Then define `HandlerName<E>`, which turns `"click"` into `"onClick"`.

```ts starter
type Base = "sm" | "lg";
type Unit = "px" | "rem";

type Size = string;
type HandlerName<E extends string> = E;
```
```ts solution
type Base = "sm" | "lg";
type Unit = "px" | "rem";

type Size = `${Base}-${Unit}`;
type HandlerName<E extends string> = `on${Capitalize<E>}`;
```
```ts check
// @test `Size` has all four combinations
type _size = Expect<Equal<Size, "sm-px" | "sm-rem" | "lg-px" | "lg-rem">>;
// @test `HandlerName<"click">` is "onClick"
type _click = Expect<Equal<HandlerName<"click">, "onClick">>;
// @test it distributes over a union
type _both = Expect<Equal<HandlerName<"open" | "close">, "onOpen" | "onClose">>;
```
@hint `Capitalize<E>` upper-cases the first letter.
@end
