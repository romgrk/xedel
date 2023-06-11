

const callWithModel = fn => (_, element) => element.getModel()[fn]()

const editorCommands = {
  'core:save':  callWithModel('save'),

  // 'editor:add-cursor-below': (event, editor) => {
  //   const cursor = editor.model.getLastCursor()
  //   const position = cursor.getScreenPosition()
  //   editor.model.addCursorAtScreenPosition([position.row + 1, position.column])
  // }, 
}

const editorKeymap = {
  'TextEditor': {
    'ctrl-s': 'core:save',
  },
}

module.exports.register = () => {
  xedel.commands.add('TextEditor', editorCommands)
  xedel.keymaps.add(__filename, editorKeymap)
}
