/*
 * window.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const workspace = require('./workspace')
const openFileDialog = require('./utils/open-file-dialog')

const EditorView = require('./editor-view')

const UI_FILE = path.join(__dirname, './ui.glade')

const windowKeymap = {
  name: 'window',
  keys: {
    'ctrl-o': () => openFileDialog(workspace.loadFile),
    'ctrl-w q': ['destroy'],
  }
}

workspace.loaded.then(() => {
  // workspace.commands.registerCommands('editor', editorCommands)
  workspace.keymaps.addKeymap(MainWindow, windowKeymap)
})

class MainWindow extends Gtk.Window {
  constructor(args) {
    super(args)

    const builder = Gtk.Builder.newFromFile(UI_FILE)

    const mainBox = workspace.mainGrid = builder.getObject('mainBox')
    const mainGrid = workspace.mainGrid = builder.getObject('mainGrid')
    const toolbar = workspace.toolbar = builder.getObject('toolbar')
    const statusbar = workspace.statusbar = builder.getObject('statusbar')

    toolbar.getStyleContext().addClass('main-toolbar')

    workspace.currentView = new EditorView()

    mainGrid.attach(workspace.currentView, 0, 0, 1, 1)

    this.add(mainBox)
    this.setDefaultSize(800, 400)

    this.on('show', () => this.onShow())
    this.on('destroy', () => this.onDestroy())

    workspace.set({
      mainWindow: this,
      toolbar,
      statusbar,
      mainGrid,
    })
  }

  onShow() {
    Gtk.main()
  }

  onDestroy() {
    Gtk.mainQuit()
    process.exit(0)
  }
}

module.exports = MainWindow
