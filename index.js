// Copyright (c) 2016 Simon Larcher All Rights Reserved.
// Usage:
// Enable logging:
// $ WARN=true node index.js "..."
// otherwise $ node index.js "..."

var math = require('mathjs');
var _ = require('underscore')._;
var pdfu = require('pd-fileutils')
  , fs = require('fs')
  , patch
//
// function logins (a) {
//   console.log(require('util').inspect(a, { depth: null }));
// }

// Console logging function using environment variable
function WARN() {
  if (process.env.WARN === "true") {
    console.warn.apply(this, arguments)
  }
}

// Input math expression
var expression = process.argv[2];
var tree = math.parse(expression);

patch = new pdfu.Patch({nodes: [], connections: []})

var operators = {}
var variables = []
var constants = 0

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
    WARN(String(newObj.id), "-- Adding", tree.fn, "to connect to", parent, "on", inlet, "depth is", depth);

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
    WARN(String(newSymbol.id), "-- Adding symbol", tree.name, "to connect to", parent, "on", inlet, "depth is", depth);

    // Keep an ordered list of variables, it represents the precedence order in the expression
    variables.push(tree.name)
  }
  // Case of a constant value, means adding a [f ] object such as [10] or [42].
  if (tree.hasOwnProperty('value')) {
    // Auto-position
    newX = parentX + (inlet ? (20) : -20)
    newY = parentY - 20

    // Add the constant object, "tree.value" is the numerical value
    var newValue = { proto: tree.value, layout: { x: newX, y: newY }, args: [] }
    patch.addNode(newValue)
    patch.connections.push({source: {id: newValue.id, port: 0}, sink: {id: parent, port: inlet}})

    // DEBUG
    WARN("Constant connected to a", (inlet === 0 ? "hot inlet" : "cold inlet") + ", using", (inlet === 0 ? "a [receive]." : "a [loadbang]."));

    // [loaadbang] for cold inlet
    if (inlet === 1) {
      var loadbang = { proto: "loadbang", layout: { x: newX, y: newY-20 }, args: [] }
      patch.addNode(loadbang)
      patch.connections.push({source: {id: loadbang.id, port: 0}, sink: {id: newValue.id, port: 0}})
    }
    // [receive] for hot inlet
    if (inlet === 0) {
      var receive = { proto: "r", layout: { x: newX, y: newY-20 }, args: ["\\$0-const-"+constants] }
      // Add to the ordered list of variables
      variables.push("const-"+constants)
      constants++

      patch.addNode(receive)
      patch.connections.push({source: {id: receive.id, port: 0}, sink: {id: newValue.id, port: 0}})
    }
    // DEBUG
    WARN(String(newValue.id), "-- Adding value", tree.value, "to connect to", parent, "on", inlet, "(added a", (inlet ? "[loadbang])," : "[receive]),"), "depth is", depth);
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

// First, create the [outlet] object
var out_f = { proto: 'f', layout: {x: 250, y: 480}, args: []}
patch.addNode(out_f)
patch.addNode({ proto: 'outlet', layout: {x: 250, y: 520}, args: []})
patch.connections.push({source: {id: out_f.id, port: 0}, sink: {id: patch.nodes.length-1, port: 0}})
patch.addNode({ proto: 'r', layout: {x: 230, y: 460}, args: ["\\$0-trig"]})
patch.connections.push({source: {id: patch.nodes.length - 1, port: 0}, sink: {id: out_f.id, port: 0}})


// Walk the expression tree recursively and build the patch on our way
walk(tree, out_f.id, 1, depth, parentX, parentY)

// variables will hold the order of execution for the expression
var trigger = "b "
// HACK: only way I found to repeat N times a pattern and put it in a string, feels ugly!
for (var i = 0; i < variables.length; i++) {
  trigger += "b "
}

var inlet_offset = 20

// DEBUG
// WARN(variables);

// Get unique symbols and remove constants.
inlets = _.uniq(variables).filter(function (e) {
  return !e.startsWith("const-")
})

// Iterate on kept values, x, y, z etc...
inlets.forEach(function (v, i, a) {

  var s_offset = 80
  patch.addNode({ proto: 'inlet', layout: {x: inlet_offset, y: 30}, args: []})
  // Case of first inlet, also add the triggering for the whole formula
  if (i === 0) {
    patch.addNode({ proto: 't', layout: {x: inlet_offset  , y: 60}, args: ["b f"]})
    patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})
    patch.addNode({ proto: 's', layout: {x: inlet_offset + 32 , y: 90}, args: ["\\$0-"+v]})
    patch.connections.push({source: {id: patch.nodes.length - 2, port: 1}, sink: {id: patch.nodes.length - 1, port: 0}})
    patch.addNode({ proto: "t", layout: {x: 20, y: 110}, args: [trigger]})
    patch.connections.push({source: {id: patch.nodes.length - 3, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})
    // Store the id of the [trigger] object, used for the inlets mechanism
    var trigger_id = patch.nodes.length - 1

    patch.addNode({ proto: "s", layout: {x: 20, y: 150}, args: ["\\$0-trig"]})
    patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})

    // For each variable, connect to the [trigger] in the righ order
    variables.forEach(function (v, i, a) {
      patch.addNode({ proto: 's', layout: {x: 20 + s_offset, y: 150}, args: ["\\$0-"+v]})
      patch.connections.push({source: {id: trigger_id, port: i + 1}, sink: {id: patch.nodes.length - 1, port: 0}})
      s_offset += 48 + (v.length * 8)
    })
    inlet_offset += 48 + (v.length * 8)
  }
  else {
    // Other inlets/value just need a [send]
    patch.addNode({ proto: 's', layout: {x: inlet_offset, y: 60}, args: ["\\$0-"+v]})
    patch.connections.push({source: {id: patch.nodes.length - 2, port: 0}, sink: {id: patch.nodes.length - 1, port: 0}})
    inlet_offset += 48 + (v.length * 8)
  }
})

// DEBUG
// logins(patch)

// HACK: Only way I found to add a PureData comment to keep a reference of the original math expression used.
var patchStr = pdfu.renderPd(patch)
patchStr += "#X text 10 10 " + expression + ";\n"

// Write it to a file
fs.writeFileSync('/tmp/pdeval.pd', patchStr)
// Or output it to the console
// console.log(patchStr);
