// Copyright (c) 2016 Simon Larcher All Rights Reserved.

var math = require('mathjs');
var _ = require('underscore')._;
var pdfu = require('pd-fileutils')
  , fs = require('fs')
  , patch
//
// function logins (a) {
//   console.log(require('util').inspect(a, { depth: null }));
// }

// Input math expression
var expression = 'a*x*x + b*x + c'
var tree = math.parse(expression);

patch = new pdfu.Patch({nodes: [], connections: []})

var operators = {}
var variables = []

var depth = 0

// Location of root element
var parentX = 350
var parentY = 450

var newX, newY

function walk (tree, parent, inlet, depth, parentX, parentY) {

  // Case of a math operator, means addings a [+ ] or [- ] etc.
  if (tree.hasOwnProperty('op')) {
    // Auto-Position: if this is the last operator in this branch, make the branch more compact
    if ( ((tree.args[0].hasOwnProperty('name')) || (tree.args[0].hasOwnProperty('value'))) && ((tree.args[1].hasOwnProperty('name')) || (tree.args[1].hasOwnProperty('value'))) ) {
      newY = parentY - 30
      newX = parentX + (inlet ? (40) : (-40))
    }
    // Auto-Position: otherwise calculate position based on hot/cold inlet : deviate left or right on X axis
    // and along Y axis depending on branch depth
    else {
      newX = parentX + ((inlet ? (100 - (depth * 20)) : (-100 + (depth * 20))))
      newY = parentY - (50 * depth)
    }
    // Add the operator. "tree.op" is the operator symbol, it is the same in as in the object, for example "+" -> [+ ]
    var newObj = {proto: tree.op, layout: { x: newX, y: newY }, args: [] }
    patch.addNode(newObj)
    // Parent id is kept recursively in branch to add connection to parent objet.
    patch.connections.push({source: {id: newObj.id, port: 0}, sink: {id: parent, port: inlet}})

    // DEBUG
    // console.log(String(newObj.id), "-- Adding", tree.fn, "to connect to", parent, "on", inlet, "depth is", depth);

    // Store the id of this operator which is the beginning of a new branch
    parent = newObj.id
    parentX = newX
    parentY = newY
  }
  // Case of a symbol, like "x", "a", "b", means adding a [receive] object for the given symbol
  if (tree.hasOwnProperty('name')) {
    // Auto-position
    newX = parentX + (inlet ? (30) : -30)
    newY = parentY - 20

    // Add the [receive], "tree.name" is the name of the symbol: "x", "a", "n" etc.
    var newSymbol = { proto: 'r', layout: { x: newX, y: newY }, args: ["\\$0-"+tree.name] }
    patch.addNode(newSymbol)
    patch.connections.push({source: {id: newSymbol.id, port: 0}, sink: {id: parent, port: inlet}})

    // DEBUG
    // console.log(String(newSymbol.id), "-- Adding symbol", tree.name, "to connect to", parent, "on", inlet, "depth is", depth);

    // Keep an ordered list of variables, it represents the precedence order in the expression
    variables.push(tree.name)
  }
  // Case of a constant value, means adding a [f ] object such as [10] or [42].
  // TODO: The whole patch is broken if the constant is on a hot inlet, needs to be banged as well to recalculate.
  // If on cold inlet, needs a [loadbang].
  if (tree.hasOwnProperty('value')) {
    // Auto-position
    newX = parentX + (inlet ? (20) : -20)
    newY = parentY - 20

    // Add the constant object, "tree.value" is the numerical value
    var newValue = { proto: tree.value, layout: { x: newX, y: newY }, args: [] }
    patch.addNode(newValue)
    patch.connections.push({source: {id: newValue.id, port: 0}, sink: {id: parent, port: inlet}})

    // DEBUG
    // console.log(String(newValue.id), "-- Adding value", tree.value, "to connect to", parent, "on", inlet, "depth is", depth);
  }
  // Case for operators and functions, "args" are the operands and might be branches, symbols or constants. Walk() into it recur(recur(recur(recur(sively))))!
  if (tree.hasOwnProperty('args')) {
    // Arguments are one level deeper in the tree.
    depth++
    // args[0] is on inlet 0 (aka hot inlet) and args[1] on inlet 1 (cold inlet)
    var inlet = 0
    tree.args.forEach(function (node) {
      walk(node, parent, inlet, depth, parentX, parentY)
      inlet = 1
    })
  }
  // Case for parenthesis, recursive at same depth
  if (tree.hasOwnProperty('content')) {
    walk(tree.content, parent, inlet, depth, parentX, parentY)
  }
}

// First, create the [outlet] objet
var outlet = { proto: 'outlet', layout: {x: 250, y: 480}, args: []}
patch.addNode(outlet)

// Walk the expression tree recursively and build the patch on our way
walk(tree, outlet.id, 0, depth, parentX, parentY)

// variables will hold the order of execution for the expression
var trigger = ""
// HACK: only way I found to repeat N times a pattern and put it in a string, feels ugly!
for (var i = 0; i < variables.length; i++) {
  trigger += "b "
}

// Objects for inlets and recalculating

patch.addNode({ proto: 'r', layout: {x: 20, y: 50}, args: ['\\$0-recalculate']})
patch.addNode({ proto: "t", layout: {x: 20, y: 80}, args: [trigger]})
// Store the id of the [trigger] object, used for the inlets mechanism
var trigger_id = patch.nodes.length - 1
patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: trigger_id, port: 0}})

var inlet_offset = 160;

// DEBUG
// console.log(variables);

// Get unique symbols
_.uniq(variables).forEach(function (v, i, a) {

  // Get indices of other occurences of the symbol in the precedence order (stored in "variables")
  var indices = variables.reduce(function(a, e, i) {
    if (e === v)
        a.push(i);
    return a;
  }, [])

  patch.addNode({ proto: 'inlet', layout: {x: inlet_offset, y: 30}, args: []})
  patch.addNode({ proto: 't', layout: {x: inlet_offset, y: 60}, args: ["b f"]})
  patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})
  patch.addNode({ proto: 's', layout: {x: inlet_offset, y: 90}, args: ["\\$0-recalculate"]})
  patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})

  patch.addNode({ proto: 'f', layout: {x: inlet_offset, y: 160}, args: []})
  // For each of the occurences, connect the corresponding [trigger] outlet
  indices.forEach(function (v) {
    patch.connections.push({source: {id: trigger_id, port: v}, sink: {id: patch.nodes.length - 1, port: 0}})
  })

  patch.connections.push({source: {id: patch.nodes.length - 3, port: 1}, sink: {id: patch.nodes.length - 1, port: 1}})
  patch.addNode({ proto: 's', layout: {x: inlet_offset, y: 190}, args: ["\\$0-"+v]})
  patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})
  inlet_offset += 140
})

// DEBUG
// logins(patch)

// HACK: Only way I found to add a PureData comment to keep a reference of the original math expression used.
var patchStr = pdfu.renderPd(patch)
patchStr += "#X text 10 10 " + expression + ";\n"

// Write it to a file
// fs.writeFileSync('/tmp/pdeval.pd', patchStr)
// Or output it to the console
console.log(patchStr);
