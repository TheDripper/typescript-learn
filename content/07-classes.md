---
id: classes
title: Classes
summary: Typed fields and methods, inheritance, member visibility, generics, this, and abstract classes.
source: https://www.typescriptlang.org/docs/handbook/2/classes.html
---

@lesson class-members | Class members | 9

TypeScript adds type annotations and related syntax to JavaScript's classes.

## Fields

Fields can be annotated, and initializers drive inference. With `strictPropertyInitialization`, each field must be set in the constructor or at its declaration:

```ts
class Point {
  x = 0;
  y = 0;
  name: string; // ✗ Not initialized, and not assigned in the constructor.
}
```

If something else sets the field, use the definite assignment operator, `!`: `name!: string;`.

## `readonly`

`readonly` fields can only be assigned at their declaration or in the constructor:

```ts
class Greeter {
  readonly name: string = "world";

  constructor(name?: string) {
    if (name !== undefined) this.name = name;
  }

  rename() {
    this.name = "other"; // ✗ Assignment outside the constructor.
  }
}
```

## Constructors and methods

Constructors take annotated parameters, optional parameters and overloads, just as functions do, but they can't have type parameters or a return type. In a derived class you must call `super()` before touching `this`. Methods are typed like any function. Inside a method, unqualified names refer to the enclosing scope, not to the class, so you always write `this.x`.

## Getters and setters

Accessors are typed too. If there's a `get` and no `set`, the property is `readonly`. The type of a setter's parameter can be wider than the getter's return type:

```ts
class Thing {
  private _size = 0;

  get size(): number {
    return this._size;
  }

  set size(value: string | number) {
    this._size = Number(value);
  }
}
```

@quiz check
@q Where can a `readonly` field be assigned?
- [ ] Anywhere inside the class
- [x] At its declaration or in the constructor
- [ ] Nowhere, it must be set by the caller
@why After construction, a `readonly` field can't be reassigned through the class.
@q A class has `get total()` with no `set`. What is `total`?
- [x] Automatically `readonly`
- [ ] A compile error
- [ ] Writable, because getters don't affect assignment
@why An accessor with no setter is inferred as `readonly`.
@end

@exercise counter-class | Type a class
Complete `Counter`: a `readonly` string `label` set by the constructor, a numeric `count` starting at `0`, and an `increment(by?: number)` method that returns `this.count`.

```ts starter
class Counter {
  label;

  constructor(label) {}

  increment(by) {}
}
```
```ts solution
class Counter {
  readonly label: string;
  count = 0;

  constructor(label: string) {
    this.label = label;
  }

  increment(by = 1): number {
    this.count += by;
    return this.count;
  }
}
```
```ts check
const _counter = new Counter("clicks");
// @test `label` is a string
type _label = Expect<Equal<typeof _counter.label, string>>;
// @test `label` is read-only
// @ts-expect-error
_counter.label = "x";
// @test `count` is a number
type _count = Expect<Equal<typeof _counter.count, number>>;
// @test `increment` works with no argument
_counter.increment();
// @test `increment` takes a number
_counter.increment(5);
// @test `increment` returns a number
type _inc = Expect<Equal<ReturnType<typeof _counter.increment>, number>>;
```
@hint Default parameters are optional, and they infer their type: `by = 1`.
@end

@lesson heritage | implements and extends | 8

## `implements`

`implements` checks that a class satisfies an interface. It doesn't change the class's type at all, so parameters aren't contextually typed from the interface:

```ts
interface Pingable {
  ping(): void;
}

class Sonar implements Pingable {
  ping() {
    console.log("ping!");
  }
}

class Ball implements Pingable { // ✗ Ball is missing 'ping'.
  pong() {}
}
```

Likewise, an optional property in the interface isn't created in the class by `implements`.

## `extends` and overriding

A derived class has all of its base class's members, and can add more. An override must remain compatible with the base, so that a derived instance can always be used as the base class:

```ts
class Base {
  greet() {
    console.log("Hello, world!");
  }
}

class Derived extends Base {
  greet(name?: string) {
    if (name === undefined) {
      super.greet();
    } else {
      console.log(`Hello, ${name.toUpperCase()}`);
    }
  }
}

const b: Base = new Derived();
b.greet();
```

Making `name` required here would be an error, since callers using the `Base` type can call `greet()` with no argument.

## Initialization order

Base class fields and constructor run **first**, then derived class fields, then the derived constructor. So a base constructor sees its own value for a field, even when the derived class redeclares it.

@quiz check
@q Does `class C implements I` change the types of C's method parameters?
- [ ] Yes, they're inferred from `I`
- [x] No, `implements` only checks compatibility
@why It's a check, nothing more. You still have to annotate the class yourself.
@q In what order does initialization happen?
- [x] Base fields, base constructor, derived fields, derived constructor
- [ ] Derived fields, derived constructor, base fields, base constructor
- [ ] Derived constructor, then base constructor
@why The base class is fully set up before the derived class's fields are initialized.
@end

@exercise shapes-implements | Implement and extend
Make `Rectangle` implement `HasArea`. Then make `Square` extend `Rectangle`, with a constructor that takes one `side`, passed as both `width` and `height` to `super`.

```ts starter
interface HasArea {
  area(): number;
}

class Rectangle {
  constructor(public width: number, public height: number) {}
}

class Square {}
```
```ts solution
interface HasArea {
  area(): number;
}

class Rectangle implements HasArea {
  constructor(public width: number, public height: number) {}

  area(): number {
    return this.width * this.height;
  }
}

class Square extends Rectangle {
  constructor(side: number) {
    super(side, side);
  }
}
```
```ts check
// @test `Rectangle` satisfies HasArea
const _r: HasArea = new Rectangle(1, 2);
// @test `Square` is a Rectangle
const _s: Rectangle = new Square(2);
// @test `Square` takes a single side
type _squareArgs = Expect<Equal<ConstructorParameters<typeof Square>, [number]>>;
// @test `area` returns a number
type _area = Expect<Equal<ReturnType<Square["area"]>, number>>;
```
@hint A derived constructor must call `super(...)`.
@end

@lesson visibility | Visibility and static members | 9

Members are `public` by default. `protected` members are visible in the class and its subclasses. `private` members are visible only in the class itself.

```ts
class Greeter {
  public greet() {
    console.log(`Hello, ${this.getName()}`);
  }
  protected getName() {
    return "hi";
  }
}

const g = new Greeter();
g.greet();
g.getName(); // ✗ 'getName' is protected.
```

## `private` is a compile-time check

`private` is only enforced by the checker, and it disappears when emitted. Bracket access still works, and at runtime nothing's protected. JavaScript's `#field` syntax is **hard private**, enforced by the runtime:

```ts
class Safe {
  private secretKey = 12345;
  #reallySecret = 54321;

  read() {
    return this.#reallySecret;
  }
}

const s = new Safe();
console.log(s["secretKey"]); // Allowed: an intentional escape hatch.
console.log(s.secretKey); // ✗ 'secretKey' is private.
```

`private` also allows access between instances of the same class.

## Static members

Static members belong to the class itself, and can have visibility modifiers. A few names, like `name` and `length`, aren't allowed because they would collide with properties of `Function`. A `static` block runs once to set up class state:

```ts
class Foo {
  static #count = 0;

  static get count() {
    return Foo.#count;
  }

  static {
    Foo.#count = 10;
  }
}

Foo.count;
```

Use plain functions and objects in place of a class made entirely of statics, since JavaScript doesn't need them to organize code.

@quiz check
@q What's the practical difference between `private x` and `#x`?
- [x] `private` is enforced only by the checker, while `#x` is enforced at runtime
- [ ] `#x` is only visible to subclasses
- [ ] There's no difference
@why `private` is erased in the output. `#x` is real JavaScript private state.
@q Which members can a subclass access?
- [x] `public` and `protected`
- [ ] `public` only
- [ ] All, including `private`
@why `private` members are restricted to the class that declares them.
@end

@exercise bank-account | Control access
Make `balance` `private`, so that it's only changeable via `deposit`. Add a `protected` method named `audit` returning `this.balance`, and a `public static` numeric `created` that begins at `0`.

```ts starter
class Account {
  balance = 0;

  deposit(amount: number) {
    this.balance += amount;
  }
}
```
```ts solution
class Account {
  private balance = 0;
  public static created = 0;

  deposit(amount: number) {
    this.balance += amount;
  }

  protected audit(): number {
    return this.balance;
  }
}
```
```ts check
const _account = new Account();
// @test `balance` can't be read from outside
// @ts-expect-error
_account.balance;
// @test `audit` can't be called from outside
// @ts-expect-error
_account.audit();
// @test `audit` is available to subclasses
class _Sub extends Account {
  check(): number {
    return this.audit();
  }
}
// @test `created` is a static number
type _created = Expect<Equal<typeof Account.created, number>>;
```
@hint Modifiers go before the member name: `private balance = 0;`.
@end

@lesson generics-and-this | Generic classes and this | 9

## Generic classes

Classes can be generic, and work like generic interfaces. `static` members can't refer to a class's type parameters, since there's only one copy of them at runtime:

```ts
class Box<Type> {
  contents: Type;
  constructor(value: Type) {
    this.contents = value;
  }
}

const b = new Box("hello!"); // Box<string>
```

## `this` at runtime

JavaScript decides `this` by how a function is **called**, not where it's defined. An arrow-function field captures the right `this`, at the cost of one copy per instance. Alternatively, a `this` parameter makes the checker reject the wrong kind of call:

```ts
class MyClass {
  name = "MyClass";

  getName = () => {
    return this.name;
  };

  getNameSafe(this: MyClass) {
    return this.name;
  }
}

const c = new MyClass();
const unbound = c.getNameSafe;
console.log(unbound()); // ✗ 'this' would be the wrong type here.
```

## The `this` type

Inside a class, `this` is a type that refers dynamically to the current class. In a subclass, methods that return `this` return the subclass, which makes for fluent APIs:

```ts
class Builder {
  parts: string[] = [];
  add(part: string): this {
    this.parts.push(part);
    return this;
  }
}

class HtmlBuilder extends Builder {
  tag(name: string): this {
    return this.add(`<${name}>`);
  }
}

new HtmlBuilder().add("x").tag("div");
```

## Parameter properties

A visibility modifier on a constructor parameter declares and assigns a field in one go. Note that this is one of the few TypeScript features that emits code:

```ts
class Params {
  constructor(public readonly x: number, private z: number) {}
}

const p = new Params(1, 2);
console.log(p.x);
```

@quiz check
@q Can a `static` member refer to a class's type parameter?
- [ ] Yes
- [x] No
@why There is one static copy per class, and it can't vary with each instantiation's `Type`.
@q Why does `add(): this` help with subclasses?
- [x] It returns the subclass type, so subclass methods can be chained
- [ ] It makes the method run faster
- [ ] It prevents overriding
@why The `this` type follows the actual class of the instance.
@end

@exercise generic-stack | Build a generic class
Write `class Stack<T>` with a `private` `items` array, `push(item: T): this` for chaining, and `pop(): T | undefined`. Use a parameter property for an optional numeric `limit`, which is `public readonly` and defaults to `100`.

```ts starter
class Stack {
  push(item) {}
  pop() {}
}
```
```ts solution
class Stack<T> {
  private items: T[] = [];

  constructor(public readonly limit: number = 100) {}

  push(item: T): this {
    this.items.push(item);
    return this;
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}
```
```ts check
const _stack = new Stack<string>();
const _popped = _stack.pop();
// @test `pop` returns the element type or undefined
type _pop = Expect<Equal<typeof _popped, string | undefined>>;
// @test `push` can be chained
_stack.push("a").push("b");
// @test `push` rejects the wrong type
// @ts-expect-error
_stack.push(1);
// @test `items` is private
// @ts-expect-error
_stack.items;
// @test `limit` is public and numeric
type _limit = Expect<Equal<typeof _stack.limit, number>>;
// @test `limit` is read-only
// @ts-expect-error
_stack.limit = 5;
// @test the constructor accepts a limit
new Stack<number>(10);
```
@hint Combine modifiers on a parameter: `public readonly limit: number = 100`.
@end

@lesson abstract-classes | Abstract classes and class relationships | 7

An `abstract` class is a base class with some implementation missing. It can't be instantiated, and concrete subclasses have to fill in each `abstract` member:

```ts
abstract class Base {
  abstract getName(): string;

  printName() {
    console.log("Hello, " + this.getName());
  }
}

class Derived extends Base {
  getName() {
    return "world";
  }
}

new Derived().printName();
new Base(); // ✗ Can't create an instance of an abstract class.
```

## Abstract construct signatures

To accept "some class that builds a `Base`", use a construct signature. That rules out passing the abstract class itself:

```ts
abstract class Base {
  abstract getName(): string;
}

class Derived extends Base {
  getName() {
    return "world";
  }
}

function greet(ctor: new () => Base) {
  return new ctor().getName();
}

greet(Derived);
greet(Base); // ✗ An abstract class isn't assignable to a 'new' signature.
```

## Classes are structural too

Two classes with the same shape are interchangeable, even with no inheritance between them. An empty class accepts almost anything, because any object has all of its (zero) members:

```ts
class Point1 { x = 0; y = 0; }
class Point2 { x = 0; y = 0; }

const p: Point1 = new Point2();

class Empty {}
function fn(x: Empty) {}
fn(window);
fn({});
fn(100);
```

@quiz check
@q Can you use `new` on an abstract class?
- [ ] Yes, abstract is only a hint
- [x] No, only on its concrete subclasses
@why An abstract class is incomplete by definition, so the checker forbids instantiating it.
@q `class A { x = 0 }` and `class B { x = 0 }` are unrelated. Is a `B` assignable to an `A`?
- [x] Yes, because classes are compared structurally
- [ ] No, they have different names
@why Like other types, classes are compared by shape, as long as they have no private or protected members.
@end

@exercise abstract-report | Use an abstract class
Make `Report` abstract, with an `abstract title(): string` method. Add a concrete `render()` returning `string` which uses `title()`. Then create a concrete subclass `SalesReport`.

```ts starter
class Report {}

class SalesReport {}
```
```ts solution
abstract class Report {
  abstract title(): string;

  render(): string {
    return `# ${this.title()}`;
  }
}

class SalesReport extends Report {
  title() {
    return "Sales";
  }
}
```
```ts check
// @test `Report` can't be instantiated
// @ts-expect-error
new Report();
// @test `SalesReport` is a Report
const _sales: Report = new SalesReport();
// @test `render` returns a string
type _render = Expect<Equal<ReturnType<Report["render"]>, string>>;
// @test `title` returns a string
type _titleType = Expect<Equal<ReturnType<SalesReport["title"]>, string>>;
```
@hint Both the class and the method need the `abstract` keyword.
@end
