---
id: object-types
title: Object Types
summary: Property modifiers, index signatures, composing types, and the generic Array and tuple types.
source: https://www.typescriptlang.org/docs/handbook/2/objects.html
---

@lesson property-modifiers | Property modifiers | 9

## Optional properties

A `?` means a property may be absent. Under `strictNullChecks`, reading it gives `T | undefined`. Defaults in a destructuring pattern are a neat way to handle that:

```ts
interface PaintOptions {
  xPos?: number;
  yPos?: number;
}

function paint({ xPos = 0, yPos = 0 }: PaintOptions) {
  console.log(xPos.toFixed(), yPos.toFixed());
}
```

## `readonly` properties

`readonly` stops a property being reassigned through that type. It is shallow, so the contents of a `readonly` object can still change:

```ts
interface Home {
  readonly resident: { name: string; age: number };
}

function visit(home: Home) {
  home.resident.age++;
  home.resident = { name: "Viktor", age: 42 }; // ✗ 'resident' is read-only.
}
```

`readonly` doesn't affect assignability either. A writable object can be passed to something expecting a `readonly` version of it.

## Index signatures

When you know the shape of the values but not the names of the keys, use an index signature. All named properties must then match it:

```ts
interface StringDictionary {
  [key: string]: string;
  name: string;
  age: number; // ✗ 'number' isn't assignable to the index type 'string'.
}
```

A union solves that when you really need mixed values, as in `[key: string]: string | number`.

## Excess property checks

Object literals are checked more strictly than other values. A property that the target type doesn't know is an error, because it's most likely a typo:

```ts
interface SquareConfig {
  color?: string;
  width?: number;
}

declare function createSquare(config: SquareConfig): void;

createSquare({ colour: "red", width: 100 }); // ✗ Did you mean 'color'?

const options = { colour: "red", width: 100 };
createSquare(options); // Not a fresh literal, so there's no excess check.
```

@quiz check
@q Given `readonly home: { age: number }`, which is allowed?
- [x] `obj.home.age = 40`
- [ ] `obj.home = { age: 40 }`
- [ ] Neither
@why `readonly` is shallow. It protects the `home` slot, not the object inside it.
@q When does an excess property check apply?
- [ ] On every assignment
- [x] When an object literal is directly assigned or passed
- [ ] Only for classes
@why Only fresh literals are checked for extra properties. A variable holding the same object isn't.
@end

@exercise config-shape | Combine property modifiers
Define `interface Settings` with a `readonly` string `id`, an optional boolean `darkMode`, and an index signature that allows any other string key with a `string | boolean` value.

```ts starter
interface Settings {}
```
```ts solution
interface Settings {
  readonly id: string;
  darkMode?: boolean;
  [key: string]: string | boolean | undefined;
}
```
```ts check
declare const _settings: Settings;
// @test `id` is required
// @ts-expect-error
const _noId: Settings = { darkMode: true };
// @test `id` can't be reassigned
// @ts-expect-error
_settings.id = "x";
// @test `darkMode` is optional
const _minimal: Settings = { id: "a" };
// @test `darkMode` must be a boolean
// @ts-expect-error
const _badDark: Settings = { id: "a", darkMode: "yes" };
// @test other string keys are accepted
const _extra: Settings = { id: "a", theme: "blue", compact: true };
// @test other keys can't be numbers
// @ts-expect-error
const _badExtra: Settings = { id: "a", size: 3 };
```
@hint An optional property adds `undefined`, so the index signature's value type has to allow it too.
@end

@lesson composing-types | Extending and intersecting | 7

## `extends`

An interface can copy the members of others and add its own:

```ts
interface BasicAddress {
  street: string;
  city: string;
}

interface AddressWithUnit extends BasicAddress {
  unit: string;
}

const home: AddressWithUnit = { street: "1 Main", city: "Oslo", unit: "2B" };
```

Multiple bases are fine: `interface C extends A, B {}`.

## Intersection types

`&` combines existing object types into one that has all their members:

```ts
interface Colorful { color: string }
interface Circle { radius: number }

type ColorfulCircle = Colorful & Circle;

const cc: ColorfulCircle = { color: "red", radius: 42 };
```

## Which should I use?

The key difference is in how conflicts are handled. Extending an interface with an incompatible property is an **error at the declaration**. An intersection quietly combines them, and can produce `never`:

```ts
interface Person1 { name: string }
interface Person2 extends Person1 { name: number } // ✗ Incompatible with Person1.

type Person3 = { name: string } & { name: number };
type Name = Person3["name"]; // never
```

@quiz check
@q What's the type of `name` in `{ name: string } & { name: number }`?
- [ ] `string | number`
- [x] `never`
- [ ] It's a compile error
@why A value would have to be both a string and a number at once, and no such value exists.
@end

@exercise timestamped | Compose types
Using `Article` and `Timestamps` without repeating their properties, create `interface StoredArticle` that has both of them plus a numeric `id`, and `type Draft` as the intersection of `Article` with `{ draft: true }`.

```ts starter
interface Article {
  title: string;
  body: string;
}

interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

interface StoredArticle {}
type Draft = {};
```
```ts solution
interface Article {
  title: string;
  body: string;
}

interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

interface StoredArticle extends Article, Timestamps {
  id: number;
}
type Draft = Article & { draft: true };
```
```ts check
type _Flat<T> = { [K in keyof T]: T[K] };
// @test `StoredArticle` has every field
type _stored = Expect<Equal<_Flat<StoredArticle>, { id: number; title: string; body: string; createdAt: Date; updatedAt: Date }>>;
// @test `Draft` is an Article with draft: true
type _draft = Expect<Equal<_Flat<Draft>, { title: string; body: string; draft: true }>>;
```
@hint `extends` accepts a comma-separated list.
@end

@lesson generic-objects | Generic objects, arrays and tuples | 9

Generic object types take a type parameter, which avoids writing one near-identical type for each kind of content:

```ts
interface Box<Type> {
  contents: Type;
}

const boxed: Box<string> = { contents: "hello" };

type OrNull<Type> = Type | null;
type OneOrMany<Type> = Type | Type[];
```

`Array<T>` is itself a generic type, as are `Map<K, V>`, `Set<T>` and `Promise<T>`.

## `ReadonlyArray`

`ReadonlyArray<T>`, or `readonly T[]`, removes the methods that mutate:

```ts
function doStuff(values: readonly string[]) {
  const copy = values.slice();
  console.log(values[0]);
  values.push("hello!"); // ✗ 'push' doesn't exist on a readonly array.
}
```

Unlike `readonly` properties, this assignability is one-way. A mutable array can be passed as a `readonly` array, but not the reverse.

## Tuples

A **tuple** knows exactly how many elements it has, and the type at each position:

```ts
function area(size: [number, number]) {
  const [width, height] = size;
  return width * height;
}

area([3, 4]);
area([3, 4, 5]); // ✗ Tuple of length 2 can't have 3 elements.
```

Tuples can have optional elements and rest elements, and they can be `readonly`:

```ts
type Either2dOr3d = [number, number, number?];
type StringNumberBooleans = [string, number, ...boolean[]];

function dist(point: readonly [number, number]) {
  return Math.hypot(point[0], point[1]);
}

const point = [3, 4] as const;
dist(point);
```

@quiz check
@q Can a `string[]` be passed where a `readonly string[]` is expected?
- [x] Yes
- [ ] No
@why Mutable arrays can be used as read-only ones. The other direction is rejected.
@q What's the benefit of a tuple over `number[]`?
- [ ] Tuples are faster at runtime
- [x] The length and each position's type are known
- [ ] Tuples can't be destructured
@why Tuples are just arrays at runtime, but the checker tracks their exact structure.
@end

@exercise paged-tuple | Generic types and tuples
Declare a generic `interface Page<Item>` with `items: Item[]` and a numeric `total`. Then write `type Range = readonly [start: number, end: number]` and use it to type the parameter of `span`.

```ts starter
function span(range) {
  return range[1] - range[0];
}
```
```ts solution
interface Page<Item> {
  items: Item[];
  total: number;
}

type Range = readonly [start: number, end: number];

function span(range: Range) {
  return range[1] - range[0];
}
```
```ts check
// @test `Page<string>` holds strings
type _page = Expect<Equal<Page<string>["items"], string[]>>;
// @test `Page` has a numeric total
type _pageTotal = Expect<Equal<Page<boolean>["total"], number>>;
// @test `span` accepts a pair
span([1, 2]);
// @test `span` rejects three numbers
// @ts-expect-error
span([1, 2, 3]);
// @test the range is read-only
declare const _range: Range;
// @ts-expect-error
_range[0] = 5;
```
@hint Generic interfaces are declared like `interface Name<T> { ... }`.
@end
