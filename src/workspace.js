/*
 * workspace.js
 */

const { EventEmitter } = require('events')

const workspace = new EventEmitter()

Object.assign(workspace, {
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
  loaded: {
    then: fn => {
      workspace.on('loaded', fn)
    }
  },

  currentView: null,
  buffers: null,
  cwd: null,

  set: (fields) => {
    Object.assign(workspace, fields)
  }
})

module.exports = workspace
