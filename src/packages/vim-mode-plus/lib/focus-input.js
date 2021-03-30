module.exports = function focusInput (
  vimState,
  {charsMax = 1, autoConfirmTimeout, hideCursor, onChange, onCancel, onConfirm, purpose, commands} = {}
) {
  const classListToAdd = ['vim-mode-plus-input-focused']
  if (hideCursor) classListToAdd.push('hide-cursor')
  vimState.editorElement.addCssClass(...classListToAdd)

  const editor = atom.workspace.buildTextEditor({mini: true})

  vimState.inputEditor = editor // set ref for test
  editor.element.addCssClass('vim-mode-plus-input')
  if (purpose) editor.element.addCssClass(purpose)

  // So that I can skip jasmine.attachToDOM in test.
  if (atom.inSpecMode()) atom.workspace.getElement().appendChild(editor.element)
  else {
    const { measurements } = vimState.editorElement
    const width = measurements.baseCharacterWidth * 10
    const height = measurements.lineHeight
    editor.element.on('realize', () => {
      editor.element.grabFocus()
    })
    const parent = xedel.workspace.getElement()
    // FIXME: use correct coordinates when overlay is working
    parent.put(editor.element, 100, 100, width, height)
  }

  let autoConfirmTimeoutID
  const clearAutoConfirmTimer = () => {
    if (autoConfirmTimeoutID) clearTimeout(autoConfirmTimeoutID)
    autoConfirmTimeoutID = null
  }

  const unfocus = () => {
    clearAutoConfirmTimer()
    vimState.editorElement.grabFocus() // focus
    vimState.inputEditor = null // unset ref for test
    vimState.editorElement.removeCssClass(...classListToAdd)
    const parent = editor.element.getParent()
    if (parent)
      parent.remove(editor.element)
    editor.destroy()
  }

  let didChangeTextDisposable

  const confirm = text => {
    if (didChangeTextDisposable) {
      didChangeTextDisposable.dispose()
      didChangeTextDisposable = null
    }
    unfocus()
    onConfirm(text)
  }

  const confirmAfter = (text, timeout) => {
    clearAutoConfirmTimer()
    if (text) autoConfirmTimeoutID = setTimeout(() => confirm(text), timeout)
  }

  const cancel = () => {
    unfocus()
    onCancel()
  }

  vimState.onDidFailToPushToOperationStack(cancel)

  didChangeTextDisposable = editor.buffer.onDidChangeText(() => {
    const text = editor.getText()
    editor.element.toggleCssClass('has-text', text.length)
    if (text.length >= charsMax) {
      confirm(text)
    } else {
      if (onChange) onChange(text)
      if (autoConfirmTimeout) confirmAfter(text, autoConfirmTimeout)
    }
  })

  atom.commands.add(editor.element, {
    'core:cancel': event => {
      event.stopImmediatePropagation()
      cancel()
    },
    'core:confirm': event => {
      event.stopImmediatePropagation()
      confirm(editor.getText())
    }
  })
  if (commands) {
    const wrappedCommands = {}
    for (const name of Object.keys(commands)) {
      wrappedCommands[name] = function (event) {
        commands[name].call(editor.element, event)
        if (autoConfirmTimeout) {
          confirmAfter(editor.getText(), autoConfirmTimeout)
        }
      }
    }
    atom.commands.add(editor.element, wrappedCommands)
  }
}
