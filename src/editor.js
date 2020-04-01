/*
 * editor.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const context = require('./context')

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

context.loaded.then(() => {
  context.commands.registerCommands('editor', editorCommands)
  context.keymaps.addKeymap(Editor, editorKeymap)
  context.keymaps.addKeymap(Editor, editorRegisterKeymap)
})

let bufferId = 1

class Editor extends GtkSource.View {
  state = {
    mode: MODE.NORMAL,
    register: undefined,
  }

  constructor(container, options) {
    super()

    this.vexpand = true
    this.hexpand = true
    this.monospace = true
    this.showLineNumbers = true
    this.highlightCurrentLine = true

    this.on('focus-out-event', this.onFocusOut)

    this.container = container

    this.initializeBuffer(options)
  }

  initializeBuffer(options) {
    const buffer = this.getBuffer()
    buffer.highlightSyntax = true
    buffer.styleScheme = context.scheme
    buffer.id = bufferId++

    if (options) {
      let { content, language, filepath, name } = options

      if (!language) {
        const filename = path.basename(filepath) || name || 'file.txt'
        language = context.langManager.guessLanguage(filename, null) || null
      }

      // GObject props
      buffer.text = content || ''
      if (language)
        buffer.language = language

      buffer.filepath = filepath
      buffer.name =
        name ? name :
        filepath ? path.basename(filepath) :
          `[Buffer ${bufferId++}]`
    }
    else {
      buffer.name = `[Buffer ${buffer.id}]`
    }

    context.buffers.push(buffer)
  }

  onFocusOut = () => {
    this.state.register = undefined
  }

  setMode(mode) {
    this.state.mode = mode
  }
}

module.exports = Editor

/*
 * Commands
 */

function setMode(mode) {
  return (editor) => { editor.setMode(mode) }
}
