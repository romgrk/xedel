/*
 * open-file-dialog.js
 */

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

const workspace = require('../workspace')

module.exports = function openFileDialog(callback) {
  const dialog = new Gtk.FileChooserDialog(
    'Open File', workspace.mainWindow, Gtk.FileChooserAction.OPEN)
  dialog.addButton(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
  dialog.addButton(Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT)

  if (dialog.run() == Gtk.ResponseType.ACCEPT) {
    const filename = dialog.getFilename()
    setImmediate(() => callback(filename))
  }

  dialog.destroy()
}
