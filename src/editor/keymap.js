/*
 * keymap.js
 */

const xedel = require('../globals')
const TextEditorComponent = require('./text-editor-component')


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
  'editor:add-cursor-below': editor => {
    const cursor = editor.model.getLastCursor()
    const position = cursor.getScreenPosition()
    editor.model.addCursorAtScreenPosition([position.row + 1, position.column])
  },
}

const editorKeymap = {
  TextEditor: {
    'j': 'core:down',
    'k': 'core:up',
    'h': 'core:left',
    'l': 'core:right',
    'g g': 'editor:move-to-top',
    'G': 'editor:move-to-bottom',

    'w': 'editor:move-to-next-subword-boundary',
    'b': 'editor:move-to-previous-subword-boundary',

    'ctrl-j': 'editor:add-cursor-below',
  }
}

xedel.loaded.then(() => {
  xedel.commands.add('editor', editorCommands)
  xedel.keymaps.add(__filename, editorKeymap)
})


