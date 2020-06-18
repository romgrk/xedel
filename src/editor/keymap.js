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
  'editor:move-to-top': TextEditor.prototype.moveToTop,
  'editor:move-to-bottom': TextEditor.prototype.moveToBottom,
}

const editorKeymap = {
  name: 'editor',
  options: { preventPropagation: false },
  keys: {
    'j': 'core:down',
    'k': 'core:up',
    'h': 'core:left',
    'l': 'core:right',
    'g g': 'editor:move-to-top',
    'G': 'editor:move-to-bottom',
  }
}

workspace.loaded.then(() => {
  workspace.commands.registerCommands('editor', editorCommands)
  workspace.keymaps.addKeymap(TextEditor, editorKeymap)
})


