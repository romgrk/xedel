/*
 * text-buffer.js
 */


const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const { TreeCursor } = require('tree-sitter');
const walkTree = require('./tree-sitter/walk-tree')

const grammars = require('./grammars')
const workspace = require('./workspace')

let bufferId = 1

const tags = [
  { name: 'variable' },
  { name: 'keyword',               foreground: '#FF9100' },
  { name: 'constant',              foreground: '#FFAB86' },
  { name: 'property',              foreground: '#AE8A5B' },
  { name: 'operator',              foreground: '#AE8A5B' },
  { name: 'string',                foreground: '#3AAF1A' },
  { name: 'number',                foreground: '#E7E63D' },
  { name: 'punctuation',           foreground: '#7B7B7B' },
  { name: 'punctuation.bracket',   foreground: '#7B7B7B' },
  { name: 'punctuation.delimiter', foreground: '#7B7B7B' },
  { name: 'punctuation.special',   foreground: '#7B7B7B' },
  { name: 'function.builtin',      foreground: '#FFD986' },
]

class TextBuffer extends GtkSource.Buffer {
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

  initializeTree() {
    if (!grammars.parsers[this.languageName])
      return

    const start = this.getStartIter()
    const end = this.getEndIter()
    const text = this.getText(start, end, true)

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

    // console.log(this.tree)

    const getType = (node, parents) => {
      const parentTypes = parents.reduce((acc, n) =>
        `${acc ? acc + '.' : ''}${n.type}`, '')
      return parentTypes ? `${parentTypes}.${node.type}` : node.type
    }

    const applyTagByNameAtNode = (tagName, node) =>
      this.applyTagByNameAtNode(tagName, node)

    walkTree(this.tree, (node, parent, parents) => {
      /* console.log(
       *   node.startPosition.row,
       *   getType(node, parents),
       *   [node.childCount, node.text.slice(0, 50)]
       * ) */

      grammars.queries.some(q =>
        q(node, parent, parents, applyTagByNameAtNode))
    })
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
