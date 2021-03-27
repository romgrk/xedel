/*
 * keymap.js
 */

const TextEditorComponent = require('./text-editor-component')


const callWithModel = fn => element => element.model[fn]()

const editorCommands = {
  'core:move-down':  callWithModel('moveDown'),
  'core:move-up':    callWithModel('moveUp'),
  'core:move-left':  callWithModel('moveLeft'),
  'core:move-right': callWithModel('moveRight'),
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
    'j': 'core:move-down',
    'k': 'core:move-up',
    'h': 'core:move-left',
    'l': 'core:move-right',
    'g g': 'editor:move-to-top',
    'G': 'editor:move-to-bottom',

    'w': 'editor:move-to-next-subword-boundary',
    'b': 'editor:move-to-previous-subword-boundary',

    'ctrl-j': 'editor:add-cursor-below',
  }
}

module.exports.register = () => {
  xedel.commands.add('editor', editorCommands)
  xedel.keymaps.add(__filename, editorKeymap)
}


