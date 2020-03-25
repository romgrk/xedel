/*
 * assert.js
 */


module.exports = {
  unreachable,
}

function unreachable() {
  throw new Error('unreachable')
}
