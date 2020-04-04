/*
 * text-buffer.js
 */


const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const { TreeCursor } = require('tree-sitter');

const parsers = require('./parsers')
const workspace = require('./workspace')

let bufferId = 1

const tags = [
  { name: 'keyword',     foreground: '#FF9100' },
  { name: 'operator',    foreground: '#AE8A5B' },
  { name: 'string',      foreground: '#3AAF1A' },
  { name: 'punctuation', foreground: '#7B7B7B' },
]

const keywords = new Set([
  'var',
  'let',
  'const',
  'if',
  'else',
  'return',
  'function',
  'class',
  'extends',
])

const punctuation = new Set([
  '{', '}',
  '[', ']',
  '(', ')',
  ';',
  ',',
  '.',
])

const operators = new Set([
  '=', '==', '===', '!=',
  '+', '+=',
  '-', '-=',
  '*', '*=',
  '/', '/=',
])

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

        this.languageName = parsers.guessLanguage(filename)
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
    console.log('initializeTree')
    if (!parsers[this.languageName])
      return

    const start = this.getStartIter()
    const end = this.getEndIter()
    const text = this.getText(start, end, true)

    this.tree = parsers[this.languageName].parse(text)

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

    console.log('start')
    console.log(this.tree)

    const getType = (node, parents) => {
      const parentTypes = parents.reduce((acc, n) =>
        `${acc ? acc + '.' : ''}${n.type}`, '')
      return parentTypes ? `${parentTypes}.${node.type}` : node.type
    }

    walkTree(this.tree, (node, parents) => {
      console.log(
        node.startPosition.row,
        getType(node, parents),
        [node.childCount, node.text.slice(0, 50)]
      )
      if (node.type === 'string')
        this.applyTagByNameAtNode('string', node)
      else if (keywords.has(node.type))
        this.applyTagByNameAtNode('keyword', node)
      else if (punctuation.has(node.type))
        this.applyTagByNameAtNode('punctuation', node)
      else if (operators.has(node.type))
        this.applyTagByNameAtNode('operator', node)
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

function walkTree(tree, fn) {
  let node = tree.rootNode
  let parents = []

  main: while (true) {
    while (node.firstChild) {
      fn(node, parents)
      parents.push(node)
      node = node.firstChild
    }

    fn(node, parents)

    if (node.nextSibling) {
      node = node.nextSibling
      continue
    }

    while (true) {
      if (node.parent && node.parent.nextSibling) {
        parents.pop()
        node = node.parent.nextSibling
        continue main
      }
      if (node.parent) {
        parents.pop()
        node = node.parent
        continue
      }
      break
    }
    break
  }
}
