/*
 * workspace.js
 */

const createControllablePromise = require('./utils/create-controllable-promise')

const workspace = {
  mainWindow: null,
  toolbar: null,
  statusbar: null,
  mainGrid: null,

  clipboard: null,

  cssProvider: null,
  schemeManager: null,
  langManager: null,
  scheme: null,

  commands: null,
  keymaps: null,

  /*
   * Resolved after the application is initialized
   */
  loaded: createControllablePromise(),

  currentView: null,
  buffers: null,
  cwd: null,

  set: (fields) => {
    Object.assign(workspace, fields)
  }
}

module.exports = workspace
