/*
 * context.js
 */

const createControllablePromise = require('./utils/create-controllable-promise')

const context = {
  mainWindow: null,
  statusLabel: null,
  mainGrid: null,

  cssProvider: null,
  schemeManager: null,
  langManager: null,
  scheme: null,

  commands: null,
  keymapManager: null,

  /*
   * Resolved after the application is initialized
   */
  loaded: createControllablePromise(),

  currentView: null,
  buffers: null,
  cwd: null,

  set: (fields) => {
    Object.assign(context, fields)
  }
}

module.exports = context
