/*
 * window.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const workspace = require('./workspace')
const openFileDialog = require('./utils/open-file-dialog')
const getAbsolutePath = require('./utils/get-absolute-path')

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
  // workspace.commands.add('editor', editorCommands)
  workspace.keymaps.addKeymap(MainWindow, windowKeymap)
})

class MainWindow extends Gtk.ApplicationWindow {
  constructor(app) {
    super(app)

    this.focusable = true

    const builder = Gtk.Builder.newFromFile(UI_FILE)

    const mainBox = workspace.mainGrid = builder.getObject('mainBox')
    const mainGrid = workspace.mainGrid = builder.getObject('mainGrid')
    const toolbar = workspace.toolbar = builder.getObject('toolbar')

    toolbar.addCssClass('main-toolbar')


    // TODO: temporary, for testing purposes
    const filepath = getAbsolutePath('./src/editor/text-editor-component.js', workspace.cwd)
    // const filepath = getAbsolutePath('./README.md', workspace.cwd)
    const text = require('fs').readFileSync(filepath).toString()
    workspace.currentView = new EditorView({ text, filepath })
    // workspace.currentView = new EditorView()

    mainGrid.attach(workspace.currentView, 0, 0, 1, 1)

    this.setChild(mainBox)
    this.setDefaultSize(800, 800)

    this.on('destroy', () => this.onDestroy())

    workspace.set({
      mainWindow: this,
      toolbar,
      mainGrid,
    })
  }

  onDestroy() {
    process.exit(0)
  }
}

module.exports = MainWindow
