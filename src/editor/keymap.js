/*
 * keymap.js
 */

const workspace = require('../workspace')
const TextEditorComponent = require('./TextEditorComponent')


const callWithModel = fn => element => element.model[fn]()

const editorCommands = {
  'core:down':  callWithModel('moveDown'),
  'core:up':    callWithModel('moveUp'),
  'core:left':  callWithModel('moveLeft'),
  'core:right': callWithModel('moveRight'),
  'editor:move-to-top': callWithModel('moveToTop'),
  'editor:move-to-bottom': callWithModel('moveToBottom'),
  'editor:move-to-next-subword-boundary': callWithModel('moveToNextSubwordBoundary'),
  'editor:move-to-previous-subword-boundary': callWithModel('moveToPreviousSubwordBoundary'),
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

    'w': 'editor:move-to-next-subword-boundary',
    'b': 'editor:move-to-previous-subword-boundary',
  }
}

workspace.loaded.then(() => {
  workspace.commands.registerCommands('editor', editorCommands)
  workspace.keymaps.addKeymap(TextEditorComponent, editorKeymap)
})


