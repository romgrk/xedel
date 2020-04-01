/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const context = require('./context')
const Editor = require('./editor')

const editorViewCommands = {
  'editor:next-buffer':          nextBuffer,
  'editor:previous-buffer':      previousBuffer,
  'editor:close-current-buffer': closeCurrentBuffer,
}

const editorViewKeymap = {
  name: 'editor-view',
  keys: {
    'alt-,': 'editor:previous-buffer',
    'alt-.': 'editor:next-buffer',
    'alt-c': 'editor:close-current-buffer',
  }
}

context.loaded.then(() => {
  context.commands.registerCommands('editor-view', editorViewCommands)
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

    context.keymaps.addKeymap(this, editorViewKeymap)
  }

  openBuffer(options) {
    const editor = createEditor(options)
    const buffer = editor.getBuffer()

    this.appendPage(editor.container)
    this.setTabLabelText(editor.container, buffer.name)
    editor.container.show()

    this.setCurrentPage(-1)
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

  const editor = new Editor(scrollView, options)

  scrollView.add(editor)
  scrollView.editor = editor

  scrollView.showAll()

  return editor
}


/*
 * Keybinding functions
 */

function nextBuffer(editorView) {
  const pages = editorView.getNPages()
  const current = editorView.getCurrentPage()
  const next = (current + 1) % pages
  editorView.setCurrentPage(next)
}

function previousBuffer(editorView) {
  const pages = editorView.getNPages()
  const current = editorView.getCurrentPage()
  const previous = current - 1
  editorView.setCurrentPage(previous)
}

function closeCurrentBuffer(editorView) {
  editorView.removePage(editorView.getCurrentPage())
}

