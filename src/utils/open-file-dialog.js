/*
 * open-file-dialog.js
 */

const fs = require('fs')
const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

const basePath = path.join(__dirname, '..')
const files =
  fs.readdirSync(basePath).filter(f => f.endsWith('.js'))
                          .map(f => path.join(basePath, f))

module.exports = function openFileDialog(callback) {
  // FIXME: dialog.getFile() returns a GLocalFile that doesn't
  // have any useful method -.-
  console.warn('openFileDialog not implemented')
  // const dialog = new Gtk.FileChooserDialog(
  //   'Open File',
  //   xedel.mainWindow,
  //   Gtk.FileChooserAction.OPEN,
  //   Gtk.ResponseType.ACCEPT
  // )
  // dialog.addButton('Cancel', 0)
  // dialog.addButton('Accept', 1)

  // dialog.on('response', id => {
  //   if (id === Gtk.ResponseType.ACCEPT) {
  //     const filename = dialog.getFile().path
  //     setImmediate(() => callback(filename))
  //   }

  //   dialog.destroy()
  // })

  // dialog.show()

  const file = files[~~(Math.random() * files.length)]
  setImmediate(() => callback(file))
}
