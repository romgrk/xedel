/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const workspace = require('./workspace')
// const TextEditorSourceView = require('./editor/TextEditorSourceView')
const TextEditorDraw = require('./editor/TextEditorDraw')

const TextEditor = TextEditorDraw;

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

  constructor(existingBuffer) {
    super()

    const editor = createEditor()
    const buffer = existingBuffer || editor.getBuffer()
    if (existingBuffer) {
      editor.setBuffer(existingBuffer)
    }

    this.showBorder = true
    this.showTabs = true

    this.appendPage(editor.container)
    this.setTabLabelText(editor.container, buffer.name)
  }

  openBuffer(options) {
    const editor = createEditor(options)
    const buffer = editor.getBuffer()

    this.appendPage(editor.container)
    this.setTabLabelText(editor.container, buffer.name)
    editor.container.show()

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

/**
 * @param {object} [options]
 * @param {string} options.content
 * @param {string} options.filepath
 * @param {string} options.name
 * @param {GtkSourceLanguage} options.language
 */
function createEditor(options) {
  const scrollView = new Gtk.ScrolledWindow()
  scrollView.margin = 10

  const editor = TextEditor.create(scrollView, options)

  scrollView.add(editor)
  scrollView.editor = editor

  scrollView.showAll()

  return editor
}
