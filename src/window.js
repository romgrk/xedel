/*
 * window.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const openFileDialog = require('./utils/open-file-dialog')
const getAbsolutePath = require('./utils/get-absolute-path')

const EditorView = require('./editor-view')

const UI_FILE = path.join(__dirname, './ui.glade')

const windowKeymap = {
  Window: {
    'ctrl-o': () => openFileDialog(xedel.loadFile),
    'ctrl-w q': ['destroy'],
  }
}

class Window extends Gtk.ApplicationWindow {
  static register = () => {
    // xedel.commands.add('editor', editorCommands)
    xedel.keymaps.add(__filename, windowKeymap)
  }

  constructor(app) {
    super(app)

    this.focusable = true

    const builder = Gtk.Builder.newFromFile(UI_FILE)
    const mainBox = xedel.mainGrid = builder.getObject('mainBox')
    const mainGrid = xedel.mainGrid = builder.getObject('mainGrid')
    const toolbar = xedel.toolbar = builder.getObject('toolbar')

    toolbar.addCssClass('main-toolbar')

    // TODO: temporary, for testing purposes
    const filepath = path.join(__dirname, './editor/text-editor-component.js')
    // const filepath = getAbsolutePath('./README.md', xedel.cwd)
    const text = require('fs').readFileSync(filepath).toString()
    xedel.currentView = new EditorView({ text, filepath })
    // xedel.currentView = new EditorView()

    mainGrid.attach(xedel.currentView, 0, 0, 1, 1)

    this.setChild(mainBox)
    this.setDefaultSize(800, 800)

    this.on('destroy', () => this.onDestroy())
  }

  onDestroy() {
    process.exit(0)
  }
}

gi.registerClass(Window)

module.exports = Window
