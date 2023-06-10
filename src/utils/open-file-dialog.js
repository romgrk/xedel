/*
 * open-file-dialog.js
 */

const path = require('path')
const cp = require('child_process')
const fuzzy = require('fuzzy')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

let files
function listFiles() {
  return files ?? (files = cp.execSync('fd -t f').toString().trim().split('\n'))
}

module.exports = function openFileDialog(callback) {
  new Selector(callback)
}

class Selector extends Gtk.Box {
  constructor(callback) {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    })

    this.addCssClass('selector')

    this.entry = new Gtk.Entry()
    this.entry.on('changed', () => { this.onChange() })
    this.entry.on('activate', () => {
      this.close()
      const entry = this.currentEntries[0]
      if (entry) {
        const result = path.resolve(process.cwd(), entry.original)
        console.log(result)
        setImmediate(() => {
          callback(result)
        })
      }
    })
    this.append(this.entry)

    this.view = new Gtk.ScrolledWindow()
    this.view.vexpand = true
    this.append(this.view)

    this.entries = listFiles()
    this.currentEntries = this.entries.map(e => ({ string: e, original: e }))

    this.updateList()

    xedel.workspace.getElement().put(this, 120, 80, 600, 300)
    this.entry.grabFocus()
  }

  onChange() {
    const text = this.entry.getBuffer().getText()
    this.currentEntries =
      fuzzy
        .filter(text, this.entries, {
          pre: '<span foreground="__COLOR__">',
          post: '</span>',
        })
    this.currentEntries.sort((a, b) => {
      if (a.score > b.score)
        return -1
      if (a.score < b.score)
        return +1
      return a.original.length - b.original.length
    })

    this.updateList()
  }

  updateList() {
    this.list = new Gtk.ListBox()
    this.currentEntries.forEach(entry => {
      const item = new Gtk.ListBoxRow()
      const label = new Gtk.Label()
      label.setMarkup(`<span font_desc="mono">${colorize(entry.string)}</span>`)
      label.xalign = 0.0
      item.setChild(label)
      item.on('activate', () => onActivate(entry))
      this.list.append(item)
    })
    this.view.setChild(this.list)
  }

  close() {
    xedel.workspace.getElement().remove(this)
  }
}

gi.registerClass(Selector)

/**
 * @param {string} input
 */
function colorize(input) {
  let index = 0
  return input.replace(/__COLOR__/g, () => {
    return colors[index++ % colors.length]
  })
}

const colors = [
  '#12C2E9',
  '#30B5EA',
  '#4DA7EA',
  '#6B9AEB',
  '#898CEC',
  '#A67FEC',
  '#C471ED',
  '#CC6BD4',
  '#D566BC',
  '#DD60A3',
  '#E55A8A',
  '#EE5572',
  '#F64F59',
  '#EE5572',
  '#E55A8A',
  '#DD60A3',
  '#D566BC',
  '#CC6BD4',
  '#C471ED',
  '#A67FEC',
  '#898CEC',
  '#6B9AEB',
  '#4DA7EA',
  '#30B5EA',
]

