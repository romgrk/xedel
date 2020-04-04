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
  { name: 'keyword',     foreground: 'red' },
  { name: 'string',      foreground: '#3AAF1A' },
  { name: 'punctuation', foreground: '#7B7B7B' },
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

    let node = this.tree.rootNode
    main: while (true) {
      while (node.firstChild) {
        node = node.firstChild
      }

      console.log('CURRENT', node)
      if (node.parent.type !== 'string') { // node.type === 'const'
        if (node.isNamed)
          this.applyTagByNameAtNode('keyword', node)
        else
          this.applyTagByNameAtNode('punctuation', node)
      }

      if (node.nextSibling) {
        console.log('NEXT', node.nextSibling)
        node = node.nextSibling
        if (node.type === 'string') {
          this.applyTagByNameAtNode('string', node)
        }
        continue
      }
      while (true) {
        if (node.parent && node.parent.nextSibling) {
          node = node.parent.nextSibling
          continue main
        }
        if (node.parent) {
          node = node.parent
          continue
        }
        break
      }
      break
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

function display(x) {

  let c = x
  do {
    Object.keys(x).forEach(k => {
      console.log(`  "${k}": ${x[k]},`)
    })
  } while (c = c.__proto__)
}
