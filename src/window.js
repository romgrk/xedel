/*
 * window.js
 */

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Adw = gi.require('Adw', '1')

const openFileDialog = require('./utils/open-file-dialog')

const windowKeymap = {
  Window: {
  },
  Workspace: {
    'alt-o': () => openFileDialog(filepath => xedel.workspace.open(filepath)),
    'alt-,': 'pane:show-previous-item',
    'alt-.': 'pane:show-next-item',
  }
}

class Window extends Adw.ApplicationWindow {
  static register = () => {
    // xedel.commands.add('editor', editorCommands)
    xedel.keymaps.add(__filename, windowKeymap)
  }

  constructor(app) {
    super(app)
    this.focusable = false
    this.setDefaultSize(800, 800)

    this.container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    this.headerBar = new Adw.HeaderBar()
    this.container.append(this.headerBar)
    this.childContent = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    this.container.append(this.childContent)
    this.setContent(this.container)
  }

  setChild(child) {
    this.childContent.append(child)
  }
}

gi.registerClass(Window)

module.exports = Window
