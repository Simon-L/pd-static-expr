# PureData static [expr]

### Experimental and new, please look at the code before using.
##### Most likely requires some manual tweaking in the generated patch.
*See #HACKs and #TODOs in the code for known limitations.*

Generate a PureData abstraction that computes a parametric mathematical expression, similar to what [expr] does, only difference is it is made exclusively of standard Pd math objects!

`node index.js "a*x*x + b*x + c" > /tmp/expr1.pd`

![Example](http://pix.toile-libre.org/upload/original/1479672975.png)

#### Features
* Supports basic math operators
* Inlet for each symbol used
* No cold/hot inlet, updates on every change (**!!?!**)
* Keeps a reference to the original formula in the patch!

#### Limitations
* Auto-position of objects is very rudimentary and will often show overlaps between objects.
* A constant in the formula placed on a hot or cold inlet will not be triggered! *(Fix planned)*
* Basic functions like sqrt(), sin(), cos() aren't supported. *(Fix planned)*

## Motivations
Recent developments to embedding PureData patches into hardware (see [Heavy](https://enzienaudio.com), [Owl Pedal/Modular](https://hoxtonowl.com/) and [Bela](http://bela.io)) have also meant lowering the capabilities of what a patch can do, due to performance or platform limitations. In many case, one ends up with a limited set of objects and [expr], by being very dynamic in nature, is generally unavailable in these contexts.
This little script is one way to soften these limitations.

#### Ideas for improvements
* A web version, FooPlot -> Pd patches.
* An audio signal version.

## Acknowledgments
This code uses [pd-fileutils](https://github.com/sebpiq/pd-fileutils) by @sebpiq. Thanks for this!

[MathJS](http://mathjs.org/) is used for parsing the input expression.


## History

* 0.0.1: Initial rudimentary half-broken version
