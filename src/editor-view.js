/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const workspace = require('./workspace')
const TextEditorElement = require('./editor/')


workspace.loaded.then(() => {

  const editorViewCommands = {
    'pane:next':     EditorView.prototype.nextBuffer,
    'pane:previous': EditorView.prototype.previousBuffer,
    'pane:close':    EditorView.prototype.closeCurrentBuffer,
  }

  const editorViewKeymap = {
    name: 'editor-view',
    keys: {
      'alt-,': 'pane:previous',
      'alt-.': 'pane:next',
      'alt-c': 'pane:close',
    }
  }

  workspace.commands.registerCommands('editor-view', editorViewCommands)
  workspace.keymaps.addKeymap(EditorView, editorViewKeymap)
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
