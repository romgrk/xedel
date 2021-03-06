/*
 * editor.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
// const GtkSource = gi.require('GtkSource', '4')

const workspace = require('../workspace')
const TextBuffer = require('./TextBuffer')

const MODE = {
  NORMAL: 'NORMAL',
  VISUAL: 'VISUAL',
  INSERT: 'INSERT',
  SET_REGISTER: 'SET_REGISTER',
}

const editorCommands = {
  'editor:insert-mode': setMode(MODE.INSERT),
  'editor:normal-mode': setMode(MODE.NORMAL),
  'editor:visual-mode': setMode(MODE.VISUAL),
  'editor:set-register-mode': setMode(MODE.SET_REGISTER),
}

const editorKeymap = {
  name: 'editor.normal-mode',
  keys: {
    'I': 'editor:insert-mode',
    '"': 'editor:set-register-mode',
  }
}

const editorRegisterKeymap = {
  name: 'editor.set-register-mode',
  isActive: (editor) => editor.state.mode === MODE.SET_REGISTER,
  onKeyPress: (editor, key) => {
    editor.state.register
  },
  keys: {
    'escape': 'editor:normal-mode',
  }
}

workspace.loaded.then(() => {
  workspace.commands.registerCommands('editor', editorCommands)
  workspace.keymaps.addKeymap(TextEditor, editorKeymap)
  workspace.keymaps.addKeymap(TextEditor, editorRegisterKeymap)
})

let bufferId = 1

class TextEditor extends Gtk.TextView {
  state = {
    mode: MODE.NORMAL,
    register: undefined,
  }

  static create(container, options) {
    const buffer = new TextBuffer(options)
    const editor = new TextEditor(buffer, container)
    return editor
  }

  constructor(buffer, container) {
    super()

    this.vexpand = true
    this.hexpand = true
    this.monospace = true
    this.showLineNumbers = true
    this.highlightCurrentLine = true

    this.container = container
    this.setBuffer(buffer)

    this.on('focus-out-event', this.onFocusOut)
  }

  onFocusOut = () => {
    this.state.register = undefined
  }

  setMode(mode) {
    this.state.mode = mode
  }
}

module.exports = TextEditor

/*
 * Commands
 */

function setMode(mode) {
  return function() { this.setMode(mode) }
}
