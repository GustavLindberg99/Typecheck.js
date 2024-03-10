# Typecheck.js
Typecheck.js is a JavaScript library that lets you type check function parameters and return values at runtime. No compilation is necessary, any Typecheck.js code is valid JavaScript, and all type checking is done at runtime. It's compatible with both browser-based JavaScript and Node.js.

## Contents

- [Setup](#setup)
    - [Browser-based JavaScript](#browser-based-javascript)
    - [Node.js](#nodejs)
- [Basic usage](#basic-usage)
    - [Applying the `typechecked` decorator](#applying-the-typechecked-decorator)
    - [Number of parameters](#number-of-parameters)
    - [Type declarations](#type-declarations)
    - [Type checking classes](#type-checking-classes)
- [List of types](#list-of-types)
    - [Classes](#classes)
    - [Null, undefined and void types](#null-undefined-and-void-types)
    - [Function types](#function-types)
    - [The `var` type](#the-var-type)
    - [Union types](#union-types)
- [Containers and generics](#containers-and-generics)
    - [Array and set generics](#array-and-set-generics)
    - [Map generics](#map-generics)
    - [Rest parameters](#rest-parameters)
- [Special functions](#special-functions)
    - [Arrow functions](#arrow-functions)
    - [Async and generator functions](#async-and-generator-functions)
- [Scope of user-defined types](#scope-of-user-defined-types)
- [The `typechecked.instanceof` function](#the-typecheckedinstanceof-function)

## Setup
### Browser-based JavaScript
In browser-based JavaScript, the easiest way to use Typecheck.js is to include it in your HTML file:

```html
<script type="text/javascript" src="https://gustavlindberg99.github.io/Typecheck.js/typecheck.min.js"></script>
```

This allows you to use Typecheck.js in any JavaScript files on that web page.

If you're using modules, it's also possible to import Typecheck.js using the `import` keyword:

```javascript
import typechecked from "https://gustavlindberg99.github.io/Typecheck.js/typecheck.min.js";
```

### Node.js
To use Typecheck.js in Node.js, download [typecheck.js](https://gustavlindberg99.github.io/Typecheck.js/typecheck.js) into your project folder, then include it as follows:

```javascript
const typechecked = require("./typecheck.js");
```

## Basic usage
### Applying the `typechecked` decorator
Typecheck.js creates a decorator called `typechecked` which can be applied to functions and classes. Since the [decorator proposal](https://github.com/tc39/proposal-decorators) isn't implemented yet, you need to call the decorator and overwrite the function/class you're calling it on like this:

```javascript
function f(){}
f = typechecked(f);
```

An alternative syntax to this is the following (the `f` in `function f` is not required, but it's recommended so that the function name shows up correctly in the debugger):

```javascript
const f = typechecked(function f(){});
```

### Number of parameters
Typecheck.js does two things: checks the number of parameters of a function, and checks that the parameters and return type are of the correct type.

To check the number of parameters, you don't need to do anything special other than applying the `typechecked` decorator:

```javascript
function noArgs(){}
noArgs = typechecked(noArgs);

noArgs();       //OK
noArgs(1);      //TypeError: too many arguments

function oneArg(a){}
oneArg = typechecked(oneArg);

oneArg();       //TypeError: too few arguments
oneArg(1);      //OK
oneArg(1, 2);   //TypeError: too many arguments
```

### Type declarations
However, it is often useful to check that the parameters and return values of a function are of a specific type. Since JavaScript has no native syntax for this, the type declarations are placed in comments of the form `/*: Type */`:

```javascript
function square(x /*: Number */) /*: Number */ {
    return x**2;
}
square = typechecked(square);

square(4);              //OK
square("Hello World!"); //TypeError: expected parameter to be Number, got String
```

The return type is also checked:

```javascript
function square(x /*: Number */) /*: String */ {
    return x**2;
}
square = typechecked(square);

square(4);  //TypeError: expected return type to be String, got Number
```

Note that there should never be a space between `/*` and `:`. A comment such as `/* : Number */` will be ignored and treated as a regular comment. The spaces between `/*:`, the type and `*/` are however optional, so `/*:Number*/` is OK.

In case you're wondering how Typecheck.js can make comments change the functionality of the code, the `toString()` method of functions preserves comments, so functions can be converted to strings and then the comments can be parsed.

### Type checking classes
Using `typechecked` on a class automatically typechecks all of its public methods, including its constructor, getters, setters and static methods. Example:

```javascript
class MyClass{
    constructor(x /*: Number */){}
    myMethod() /*: void */ {}
}
MyClass = typechecked(MyClass);

const a = new MyClass(4);   //OK
a.myMethod();               //OK
a.myMethod(3);              //TypeError, too many arguments
const b = new MyClass("");  //TypeError, wrong type passed to constructor
```

Note that constructors should never have a return type. Specifying a return type to a constructor will throw a SyntaxError when calling `typechecked`.

This only typechecks public methods, it doesn't typecheck its private methods. This is because since `typechecked` is defined outside of the class, it doesn't have any way of accessing any private methods. Unfortunately, there is currenlty no workaround for this, so private methods can't be typechecked. However, when the [decorator proposal](https://github.com/tc39/proposal-decorators) becomes implemented, it will be possible to use `@typechecked` as a decorator on any methods, public or private.

## List of types
In typecheck.js, you can use classes in type declarations as well as a few special types. The special types are all reserved keywords on purpose so that they can't conflict with user-defined classes.

### Classes
Any class can be used in a type declaration, as long as it's either a member of `globalThis` or is itself `typechecked`. This works for all built-in types and most user-defined types. In non-module scripts, user-defined classes in the global namespace are always members of `globalThis`, so they can be used in type declarations without any restrictions. In modules, however, user-defined classes may need to be `typechecked` for it to work, see the Modules section below.

This works for built-in types as well, however, the primitive classes `Number`, `String`, `Boolean`, `Symbol` and `BigInt` check that the variable is of the corresponding primitive type and *not* an object. There is no way to type check for wrapper objects since they're not very useful. For example:

```javascript
function square(x /*: Number */) /*: Number */ {
    return x**2;
}
square = typechecked(square);

square(4);              //OK
square(new Number(4));  //TypeError
```

Other built-in types (such as `RegExp`, `Date`, `XMLHttpRequest`, etc) simply check if it's an instance of that class using `instanceof`. Built-in container types (`Array`, `Set`, `Map`) can also be used as usual, but also have the possibility to be used as generics, see the Generics section below.

Since the typechecking uses `instanceof`, instances of a derived class are also considered to be instances of a base class. For example, an `HTMLBodyElement` object is considered to also be an `HTMLElement` object, and if you have `class Base{}` and `class Derived extends Base{}`, a `Derived` object is also considered to be a `Base` object. Also, this means that everything except null or undefined is considered to be an instance of `Object` (including primitives and wrapper objects).

### Null, undefined and void types
The special type `null` can be used to check that a variable is `null`. This is mostly useful in union types, so to check that a varaible is either an instance of `SomeClass` or is null, you can use `SomeClass | null`. Similarly, `undefined` checks that a variable is undefined.

`void` is an alias for `undefined`, and is intended to be used to indicate that a function returns nothing. Since in JavaScript functions that return nothing return undefined, `void` and `undefined` are functionally identical, but are intended to have different meanings: `void` is indended to be used as the return type of functions that return nothing, and `undefined` is intended to be used for other uses of undefined.

### Function types
Since `Function` is a member of `globalThis`, it can be used to type check for functions. However, this is rarely useful since in JavaScript a "function" can mean many different things. For example, classes and arrow functions are both `Function` objects, but are almost never used in the same way. For this reason, typecheck.js has several special function types:

- `class`, checks that the variable can be called with `new`. This is true for ES6 classes as well as regular function defined using the `function(){}` syntax, but *not* for arrow functions, async functions or generator functions.
- `function`, checks that the variable is a function that can be called *without* `new`, i.e. a function that's *not* an ES6 class. Note that functions defined using the `function(){}` syntax are considered both a `class` and a `function`, since they can be called both with and without `new`. Not to be confused with `Function`, which simply checks that it's an instance of `Function`, i.e. either a function or a class.
- `async`, checks that the variable is an async function and *not* a generator function.
- `function*`, checks that the variable is a generator function and *not* an async function.
- `async*`, checks that the variable is both an async function and a generator function.

Note that `Function` is equivalent to `class | function`. However, `class | function` is more readable since it more explicitly states that both classes and functions are acceptable.

### The `var` type
The special type `var` does no type checking at all, it's equivalent to not having any type declaration. Since `Object` checks for anything that's not null or undefined (see above), `var` is functionally equivalent to `Object | null | undefined`. However, `var` has better performance.

There are a few reasons to use `var` over no type declaration at all:
- Readability. If you see a function with no type declaration, it can be hard to tell if the type declaration was left out for some other reason (for example by mistake or to make the function declaration shorter). If you use `/*: var */`, it's immediately clear that the variable can have any type.
- In some cases, for example in generics, it's not possible to omit `var`. For example, if you want a map whose keys are strings and whose values can be of any type, the only way of doing is `Map<String, var>`.

### Union types
Sometimes you might want to check that a variable has one of several types. You can do this by separating the types with a `|`. To check that a variable is either of `Type1` or of `Type2`, you can do `Type1 | Type2`. You can have as many types as you want in a union type.

This is most often useful with `null`. To check that a varaible is either an instance of `SomeClass` or is null, you can use `SomeClass | null`.

## Containers and generics
The built-in types `Array`, `Set` and `Map` can be used like any other classes in type declarations. However, often it's not enough to know that a variable is an array, set or map, you also want to know what it contains. For this reason, `Array`, `Set` and `Map` can also be used with generics.

It is not possible to create your own generics in Typecheck.js, generics can only be used with the built-in types `Array`, `Set` and `Map`.

### Array and set generics
The syntax `Array<Type>` checks not only that the variable is an array, but also that all its elements are of type `Type`. Similarly `Set<Type>` checks that the variable is a set and that all its elements are of type `Type`. `Type` can be any valid typecheck.js type, including a union type or a generic.

So for example to check that all the elements of the array are either instances of `SomeClass` or is null, you can do `Array<SomeClass | null>`. Nested generics are also allowed, for example `Array<Array<Type>>`.

Note that `Array<var>` is equivalent to just `Array`.

### Map generics
A map has both keys and values, so to check that a variable is a map, that all keys are of type `KeyType` and that all values are of type `ValueType`, you can do `Map<KeyType, ValueType>`. Again, `KeyType` and `ValueType` can be any valid typecheck.js types, including union types or generics.

If you only want to type check the keys or the values but not both, this is where `var` is useful. `Map<KeyType, var>` only typechecks the keys, and `Map<var, ValueType>` only type checks the values.

### Rest parameters
You can also do type checking on rest parameters. Since rest parameters are always arrays, the most useful way to type check them is to use an array generic. For example:

```javascript
//Allows any number of parameters, but checks that they're all numbers
//The parameters will be stored as an array
function f(...a /*: Array<Number> */){}
f = typechecked(f);

f();                //OK
f(1);               //OK
f(1, 2, 3);         //OK
f("Hello World!");  //TypeError
```

## Special functions
### Arrow functions
Arrow functions can be typechecked just like regular functions, but you can only use type declarations in arrow functions if the parameter list is enclosed in parentheses (there is no restriction on whether or not the body should be enclosed in curly braces). The return type is placed between the parameter list and the arrow.

Examples:
```javascript
//Regular arrow function with both parentheses and curly braces
typechecked((a /*: Number */, b /*: String */) /*: void */ => {});    //OK

//Omitting the curly braces is allowed
typechecked((a /*: Number */, b /*: String */) /*: Boolean */ => b.length === a);    //OK

//Omitting the parentheses around the parameters not allowed if there are type declarations
typechecked(a /*: Number */ => a);    //Ambiguous: `(a /*: Number */) => a`
                                      //or `(a) /*: Number */ => a`?

//If there aren't type declarations, omitting the parentheses is allowed
//The following just checks the number of parameters, not the types
typechecked(a => a);    //OK
```

### Async and generator functions
Async functions always return `Promise` objects and generator functions always return `Generator` objects. Since checking the return types of these functions for `Promise` or `Generator` would be redundant, the return type of any function declared with the `async` keyword instead checks the contents of the promise, and the return type of any function declared with the `function*` keyword instead checks the contents of the generator:

```javascript
async function myAsyncFunction() /*: Number */ {
    return 3;
}
myAsyncFunction = typechecked(myAsyncFunction);

function* myGeneratorFunction() /*: Number */ {
    yield 4;
}
myGeneratorFunction = typechecked(myGeneratorFunction);
```

Note that the return type of async functions is only checked once the function returns:
```javascript
async function myAsyncFunction() /*: String */ {
    await new Promise(r => setTimeout(r, 1000));
    return 3;
}
myAsyncFunction = typechecked(myAsyncFunction);

myAsyncFunction();    //Only throws a TypeError after 1 second
```

Similarly, the return type of generator functions is only checked once the function yields:

```javascript
function* myGeneratorFunction() /*: String */ {
    yield 4;
}
myGeneratorFunction = typechecked(myGeneratorFunction);

let generator = myGeneratorFunction();    //No error
generator.next();    //TypeError: expected yield value to be String, got Number
```

The parameter types of async and generator functions are checked just like any other functions, immediately when the function gets called.

## Scope of user-defined types
As stated above, you can type check for any class name that's either a member of `globalThis` or that's typechecked, including user-defined classes.

In non-module scripts, any class defined in the global namespace works, since it's a member of `globalThis`:

```html
<script type="text/javascript">
class MyClass{}
//Can be typechecked if you want, but doesn't need to to be useable in type declarations

function f(a /*: MyClass */){}
f = typechecked(f);

f(new MyClass());   //OK
f("Hello World!");  //TypeError: wrong type
</script>
```

However, if you're using modules, it's no longer that simple, since classes defined in the global namespace in modules aren't automatically members of `globalThis`:

```html
<script type="module">
class MyClass{}

function f(a /*: MyClass */){}
f = typechecked(f);

f(new MyClass());   //ReferenceError: typechecked doesn't know what MyClass is
</script>
```

The reason this doesn't work is because `MyClass` can only be accessed in the current module, and `typechecked` which is trying to access it is defined outside of the module.

However, if `MyClass` is typechecked, `typechecked` has access to it since it was passed to it earlier, and so it can be used as usual:

```html
<script type="module">
class MyClass{}
MyClass = typechecked(MyClass);

function f(a /*: MyClass */){}
f = typechecked(f);

f(new MyClass());   //OK since MyClass is typechecked
</script>
```

Because of this, however, you can't define two typechecked classes with the same name, not even in different modules.

```html
<script type="module">
class MyClass{}
MyClass = typechecked(MyClass);
</script>
<script type="module">
class MyClass{}
MyClass = typechecked(MyClass);    //ReferenceError: Redefinition of MyClass
</script>
```

This is because `typechecked` doesn't know which module it's being called from, so it doesn't know which one to choose.

Similarly, local classes can't either be used in type declarations since they're not either members of `globalThis`, unless they're typechecked (regardless of whether the script is a module or not). However, you need to be careful with anonymous classes:

```javascript
function outer(){
    class LocalClass1{};
    let inner = typechecked((a /*: LocalClass1 */) => {});
    inner(new LocalClass());    //ReferenceError: typechecked can't access LocalClass1.

    const LocalClass2 = typechecked(class{});
    inner = typechecked((a /*: LocalClass2 */) => {});
    inner(new LocalClass2());   //ReferenceError: while typechecked can access
                                //LocalClass2, it doesn't know it's called that
                                //since it was declared as an anonymous class.

    const LocalClass3 = typechecked(class LocalClass3{});
    inner = typechecked((a /*: LocalClass3 */) => {});
    inner(new LocalClass3());   //OK, LocalClass3 was declared with that name
                                //and is typechecked. However, you need to be
                                //careful not to have classes called LocalClass3
                                //anywhere else.
}
```

## The `typechecked.instanceof` function
If you want to typecheck using Typecheck.js syntax elsewhere than in function paremeters and return types, you can use the `typechecked.instanceof` function, which has the following signature:

```javascript
function typechecked.instanceof(
    obj /*: var */,
    type /*: String | class | null | undefined */
) /*: Boolean */
```

This function has the following behavior depending on the type of `type`:
- If `type` is a string, parses it as a Typecheck.js type, then returns true if `obj` is an instance of that type and false otherwise. Throws an error if the parsing failed.
- If `type` is null, returns true if `obj === null` and false otherwise.
- If `type` is undefined, returns true if `obj === undefined` and false otherwise.
- If `type` is `Number`, `String`, `Boolean`, `Symbol` or `BigInt`, returns true if `typeof obj` is `number`, `string`, `boolean`, `symbol` or `bigint` respecitvely, and false otherwise.
- If `type` is `Object`, returns true if `obj !== null` and `obj !== undefined`, and false otherwise.
- If `type` is any other class, returns the result of `obj instanceof type`.