/*
 * window.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const openFileDialog = require('./utils/open-file-dialog')
const getAbsolutePath = require('./utils/get-absolute-path')

const UI_FILE = path.join(__dirname, './ui.glade')

const windowKeymap = {
  Window: {
    'ctrl-o': () => openFileDialog(filepath => xedel.workspace.open(filepath)),
  },
  Workspace: {
    'alt-,': 'pane:show-previous-item',
    'alt-.': 'pane:show-next-item',
  }
}

class Window extends Gtk.ApplicationWindow {
  static register = () => {
    // xedel.commands.add('editor', editorCommands)
    xedel.keymaps.add(__filename, windowKeymap)
  }

  constructor(app) {
    super(app)
    this.focusable = false
    this.setDefaultSize(800, 800)
    this.on('destroy', () => this.onDestroy())
  }

  onDestroy() {
    process.exit(0)
  }
}

gi.registerClass(Window)

module.exports = Window
