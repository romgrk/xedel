/*
 * editor-view.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

let bufferId = 1

module.exports =
class EditorView extends Gtk.Notebook {

  constructor(context, existingBuffer) {
    super()
    // Gtk.Notebook.call(this)

    const sourceView = createSourceView(context)
    const buffer = existingBuffer || sourceView.getBuffer()
    if (existingBuffer) {
      sourceView.setBuffer(existingBuffer)
    }

    this.appendPage(sourceView.container)
    this.setTabLabelText(sourceView.container, buffer.name)

    this.buffers = [buffer]
    this.context = context
  }


  openBuffer(options) {
    const sourceView = createSourceView(this.context, options)
    const buffer = sourceView.getBuffer()

    this.appendPage(sourceView.container)
    this.setTabLabelText(sourceView.container, buffer.name)
    this.buffers.push(sourceView.getBuffer())
    sourceView.container.show()

    this.setCurrentPage(this.buffers.length - 1)
    this.updateBufferList()
  }

  updateBufferList() {
    const n = this.getNPages()
    for (let i = 0; i < n; i++) {
      const page = this.getNthPage(i)
      this.setTabLabelText(page, this.buffers[i].name)
    }
  }
}

function createSourceView(state, options) {
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
  sourceView.getStyleContext().addProvider(state.cssProvider, 9999)

  sourceView.container = scrollView

  scrollView.add(sourceView)
  scrollView.sourceView = sourceView

  const buffer = sourceView.getBuffer()
  buffer.highlightSyntax = true
  buffer.styleScheme = state.scheme
  buffer.name = `[Buffer ${bufferId++}]`
  buffer.id = bufferId

  if (options) {
    let { content, language, filepath, name } = options

    if (!language)
      language = state.langManager.guessLanguage(filepath || name, null) || null

    buffer.text = content
    buffer.language = language
    buffer.filepath = filepath
    buffer.name =
      name ?
        name :
      filepath ?
        path.basename(filepath) :
        `[Buffer ${bufferId++}]`
  }

  state.buffers.push(buffer)

  scrollView.showAll()

  return sourceView
}
