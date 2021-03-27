/*
 * assert.js
 */


module.exports = {
  unreachable,
}

function unreachable() {
  debugger
  throw new Error('unreachable')
}
