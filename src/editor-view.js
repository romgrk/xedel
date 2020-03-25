/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const context = require('./context')

let bufferId = 1

const editorCommands = {
  'editor:next-buffer':          nextBuffer,
  'editor:previous-buffer':      previousBuffer,
  'editor:close-current-buffer': closeCurrentBuffer,
}

const editorViewKeymap = {
  name: 'editor-view',
  keybindings: {
    'Alt+,': 'editor:previous-buffer',
    'Alt+.': 'editor:next-buffer',
    'Alt+C': 'editor:close-current-buffer',
  }
}

const sourceViewKeymap = {
  name: 'source-view',
  keybindings: {
    'I': 'editor:insert-mode',
  }
}

context.loaded.then(() => {
  context.commands.registerCommands('editor-view', editorCommands)
})

const tagHighlight = new Gtk.TextTag('highlight')
tagHighlight.background = '#EEE130'

class EditorView extends Gtk.Notebook {

  constructor(existingBuffer) {
    super()

    const sourceView = createSourceView()
    const buffer = existingBuffer || sourceView.getBuffer()
    if (existingBuffer) {
      sourceView.setBuffer(existingBuffer)
    }

    this.showBorder = true
    this.showTabs = true

    this.appendPage(sourceView.container)
    this.setTabLabelText(sourceView.container, buffer.name)

    context.keymapManager.addKeymap(this, editorViewKeymap)
  }

  openBuffer(options) {
    const sourceView = createSourceView(options)
    const buffer = sourceView.getBuffer()

    this.appendPage(sourceView.container)
    this.setTabLabelText(sourceView.container, buffer.name)
    sourceView.container.show()

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
function createSourceView(options) {
  const scrollView = new Gtk.ScrolledWindow()
  scrollView.margin = 10
  const sourceView   = new GtkSource.View()
  sourceView.vexpand = true
  sourceView.hexpand = true
  sourceView.monospace = true
  sourceView.showLineNumbers = true
  sourceView.highlightCurrentLine = true
  // sourceView.pixelsAboveLines = 10
  // sourceView.pixelsBelowLines = 10
  sourceView.getStyleContext().addProvider(context.cssProvider, 9999)

  sourceView.container = scrollView

  context.keymapManager.addKeymap(sourceView, sourceViewKeymap)

  scrollView.add(sourceView)
  scrollView.sourceView = sourceView

  const buffer = sourceView.getBuffer()
  buffer.highlightSyntax = true
  buffer.styleScheme = context.scheme
  buffer.name = `[Buffer ${bufferId++}]`
  buffer.id = bufferId

  if (options) {
    let { content, language, filepath, name } = options

    if (!language) {
      const filename = path.basename(filepath) || name || 'file.txt'
      language = context.langManager.guessLanguage(filename, null) || null
    }

    // GObject props
    buffer.text = content || ''
    if (language)
      buffer.language = language

    buffer.filepath = filepath
    buffer.name =
      name ?
        name :
      filepath ?
        path.basename(filepath) :
        `[Buffer ${bufferId++}]`
  }

  const tagTable = buffer.getTagTable()
  tagTable.add(tagHighlight)

  context.buffers.push(buffer)

  scrollView.showAll()

  return sourceView
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

