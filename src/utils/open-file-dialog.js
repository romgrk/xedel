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
  return files ?? (files = cp.execSync('fd').toString().trim().split('\n'))
}

module.exports = function openFileDialog(callback) {
  new Selector(callback)
}

class Selector extends Gtk.Box {
  constructor(callback) {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    })

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
    this.view.setSizeRequest(-1, 200)
    this.append(this.view)

    this.entries = listFiles()
    this.currentEntries = this.entries.map(e => ({ string: e, original: e }))

    this.updateList()

    xedel.workspace.getElement().put(this, 100, 100, 400, 300)
    this.entry.grabFocus()
  }

  onChange() {
    const text = this.entry.getBuffer().getText()
    this.currentEntries =
      fuzzy
        .filter(text, this.entries, {
          pre: '<span foreground="#ff0000">',
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
      label.setMarkup(entry.string)
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
