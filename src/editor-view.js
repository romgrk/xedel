/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const xedel = require('./globals')
const TextEditorElement = require('./editor/')


xedel.loaded.then(() => {

  const editorViewCommands = {
    'pane:next':     EditorView.prototype.nextBuffer,
    'pane:previous': EditorView.prototype.previousBuffer,
    'pane:close':    EditorView.prototype.closeCurrentBuffer,
  }

  const editorViewKeymap = {
    EditorView: {
      'alt-,': 'pane:previous',
      'alt-.': 'pane:next',
      'alt-c': 'pane:close',
    }
  }

  xedel.commands.add('editor-view', editorViewCommands)
  xedel.keymaps.add(__filename, editorViewKeymap)
})

class EditorView extends Gtk.Notebook {

  constructor(options) {
    super()

    this.showBorder = true
    this.showTabs = true

    this.openBuffer(options)
  }

  openBuffer(options) {
    const editor = TextEditorElement.create(options)

    this.appendPage(editor)
    this.setTabLabelText(editor, editor.getBuffer().getName())

    this.setCurrentPage(-1)
  }

  /*
   * Commands
   */

  nextBuffer() {
    const pages = this.getNPages()
    const current = this.getCurrentPage()
    const next = (current + 1) % pages
    this.setCurrentPage(next)
  }

  previousBuffer() {
    const pages = this.getNPages()
    const current = this.getCurrentPage()
    const previous = current - 1
    this.setCurrentPage(previous)
  }

  closeCurrentBuffer() {
    this.removePage(this.getCurrentPage())
  }
}

module.exports = EditorView
