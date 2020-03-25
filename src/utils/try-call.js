/*
 * try-call.js
 */

module.exports = function tryCall(fn, ...args) {
  try {
    return fn(...args)
  } catch(e) {
    console.error(e)
    process.exit(1)
  }
}
