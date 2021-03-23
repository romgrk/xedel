/*
 * globals.js
 */

const { EventEmitter } = require('events')

const xedel = new EventEmitter()

Object.assign(xedel, {
  mainWindow: null,
  toolbar: null,
  statusbar: null,
  mainGrid: null,

  clipboard: null,

  cssProvider: null,

  commands: null,
  keymaps: null,

  /*
   * Resolved after the application is initialized
   */
  loaded: {
    then: fn => {
      xedel.on('loaded', fn)
    }
  },

  currentView: null,
  buffers: null,
  cwd: null,

  set: (fields) => {
    Object.assign(xedel, fields)
  }
})

global.xedel = xedel
// Compatibility with existing atom plugins:
global.atom = xedel

module.exports = xedel
