/*
 * text-buffer.js
 */


const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
// const GtkSource = gi.require('GtkSource', '4')

const grammars = require('../grammars')
const workspace = require('../workspace')

let bufferId = 1

const tags = [
  { name: 'embedded',              foreground: '#fefefe' },
  { name: 'variable' },
  { name: 'variable.parameter' },
  { name: 'variable.builtin' },
  { name: 'keyword',               foreground: '#FF9100' },
  { name: 'constant',              foreground: '#FFAB86' },
  { name: 'constant.builtin',      foreground: '#FFAB86' },
  { name: 'property',              foreground: '#AE8A5B' },
  { name: 'operator',              foreground: '#AE8A5B' },
  { name: 'string',                foreground: '#3AAF1A' },
  { name: 'string.special',        foreground: '#3AAF1A' },
  { name: 'number',                foreground: '#E7E63D' },
  { name: 'comment',               foreground: '#7B7B7B' },
  { name: 'punctuation',           foreground: '#7B7B7B' },
  { name: 'punctuation.bracket',   foreground: '#7B7B7B' },
  { name: 'punctuation.delimiter', foreground: '#7B7B7B' },
  { name: 'punctuation.special',   foreground: '#7B7B7B' },
  { name: 'constructor' },
  { name: 'function',              foreground: '#FFD986' },
  { name: 'function.method',       foreground: '#FFD986' },
  { name: 'function.builtin',      foreground: '#FFD986' },
]


class TextBuffer extends Gtk.TextBuffer {
  languageName = undefined

  constructor(options) {
    super()

    workspace.buffers.push(this)

    this.highlightSyntax = true
    this.styleScheme = workspace.scheme
    this.id = bufferId++

    if (options) {
      let { content, language, filepath, name } = options

      if (!language) {
        const filename = path.basename(filepath) || name || 'file.txt'
        language = workspace.langManager.guessLanguage(filename, null) || null

        this.languageName = grammars.guessLanguage(filename)
      }

      // GObject props
      this.text = content || ''
      /* if (language)
       *   this.language = language */

      // Custom props
      this.filepath = filepath
      this.name =
        name ? name :
        filepath ? path.basename(filepath) :
          `[Buffer ${bufferId++}]`
    }
    else {
      this.name = `[Buffer ${this.id}]`
    }

    this.placeCursor(this.getStartIter())
    this.initializeTagTable()
    this.initializeTree()
  }

  getAllText() {
    const start = this.getStartIter()
    const end = this.getEndIter()
    const text = this.getText(start, end, true)
    return text
  }

  getLines() {
    return this.getAllText().split('\n')
  }

  lineForRow(n) {
    return this.getAllText().split('\n')[n]
  }

  initializeTree() {
    if (!grammars.parsers[this.languageName])
      return

    const text = this.getAllText()

    this.tree = grammars.parsers[this.languageName].parser.parse(text)

    this.initializeSyntax()
  }

  applyTagByNameAtNode(name, node) {
    const start = this.getIterAtLineOffset(node.startPosition.row, node.startPosition.column)
    const end   = this.getIterAtLineOffset(node.endPosition.row,   node.endPosition.column)
    this.applyTagByName(name, start, end)
  }

  initializeSyntax() {
    if (!this.tree)
      return

    const query = grammars.parsers[this.languageName].query

    if (!query)
      return

    const captures = query.captures(this.tree.rootNode)

    for (let i = 0; i < captures.length; i++) {
      const capture = captures[i]
      this.applyTagByNameAtNode(capture.name, capture.node)
    }
  }

  initializeTagTable() {
    const table = this.getTagTable()
    tags.forEach(d => {
      table.add(createTag(d))
    })
  }
}

module.exports = TextBuffer

function createTag(d) {
  const tag = new Gtk.TextTag({ name: d.name })
  if (d.background) tag.background = d.background
  if (d.foreground) tag.foreground = d.foreground
  return tag
}
