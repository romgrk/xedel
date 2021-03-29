/*
 * assert.js
 */

// TODO: disable in production?

module.exports = {
  assert,
  unreachable,
}

function assert(condition, message = 'Assertion failed') {
  if (condition)
    return
  debugger
  throw new Error(message)
}

function unreachable() {
  debugger
  throw new Error('unreachable')
}
