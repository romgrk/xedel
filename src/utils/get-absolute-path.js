/*
 * get-absolute-path.js
 */

const path = require('path')

module.exports = function getAbsolutePath(filepath, cwd) {
  return path.isAbsolute(filepath) ?
    filepath :
    path.join(cwd, filepath)
}
