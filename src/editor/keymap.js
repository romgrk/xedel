/*
 * keymap.js
 */

const workspace = require('../workspace')
const TextEditor = require('./TextEditorDraw')


const editorCommands = {
  'core:down':  TextEditor.prototype.moveDown,
  'core:up':    TextEditor.prototype.moveUp,
  'core:left':  TextEditor.prototype.moveLeft,
  'core:right': TextEditor.prototype.moveRight,
}

const editorKeymap = {
  name: 'editor',
  options: { preventPropagation: false },
  keys: {
    'j': 'core:down',
    'k': 'core:up',
    'h': 'core:left',
    'l': 'core:right',
  }
}

workspace.loaded.then(() => {
  workspace.commands.registerCommands('editor', editorCommands)
  workspace.keymaps.addKeymap(TextEditor, editorKeymap)
})


