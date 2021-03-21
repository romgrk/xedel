/*
 * open-file-dialog.js
 */

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

const workspace = require('../workspace')

module.exports = function openFileDialog(callback) {
  // FIXME: dialog.getFile() returns a GLocalFile that doesn't
  // have any useful method -.-
  console.warn('openFileDialog not implemented')
  // const dialog = new Gtk.FileChooserDialog(
  //   'Open File',
  //   workspace.mainWindow,
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
}
