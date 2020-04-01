const fs = require('fs')
const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const context = require('./context')

const EditorView = require('./editor-view')
const CommandsManager = require('./commands-manager')
const KeymapManager = require('./keymap-manager')

const getAbsolutePath = require('./utils/get-absolute-path')

const readFile = fs.promises.readFile

// Paths

const gladeFile = path.join(__dirname, './ui.glade')
const styleFile = path.join(__dirname, './style.css')

gi.startLoop()
Gtk.init([])
Gdk.init([])

const builder = Gtk.Builder.newFromFile(gladeFile)

const schemeManager = GtkSource.StyleSchemeManager.getDefault()
const langManager = GtkSource.LanguageManager.getDefault()

let styleFileWatcher

const windowKeymap = {
  name: 'window',
  keys: {
    'ctrl-o': openFileDialog,
    'ctrl-w q': ['destroy'],
  }
}

context.set({
  mainWindow: null,
  statusLabel: null,
  mainGrid: null,
  cssProvider: new Gtk.CssProvider(),
  schemeManager: schemeManager,
  langManager: langManager,
  keymaps: null,
  scheme: schemeManager.getScheme('builder-dark'),

  currentView: null,
  buffers: [],
  cwd: process.cwd(),
})

context.loaded.then(() => {
  console.log('Loaded')
})

function main() {

  const mainWindow = context.mainWindow = builder.getObject('mainWindow')
  const mainGrid = context.mainGrid = builder.getObject('mainGrid')
  const statusLabel = context.statusLabel = builder.getObject('statusLabel')

  builder.connectSignals({
    onWindowShow: Gtk.main,
    onWindowDestroy: onWindowDestroy,
    onCloseBtnClicked: () => {
      mainWindow.close()
    },
    onActionBtnClicked: () => {
      console.log('button clicked')
    }
  })

  const commands = context.commands = new CommandsManager()

  const keymaps = context.keymaps = new KeymapManager()
  keymaps.addKeymap(mainWindow, windowKeymap)

  context.currentView = new EditorView()

  mainGrid.attach(context.currentView, 0, 0, 1, 1)

  mainWindow.setDefaultSize(800, 800)

  Promise.all([
    initializeStyle(),
    loadFile('src/index.js'),
  ])
  .then(() => {
    setImmediate(() => context.loaded.resolve())
    mainWindow.showAll()
  })
}

function onWindowDestroy() {
  Gtk.mainQuit()
  process.exit(0)
}

function loadFile(filepath) {
  console.log(`Loading "${filepath}"`)

  const realpath = getAbsolutePath(filepath, context.cwd)

  return readFile(realpath)
  .then(content => {
    context.currentView.openBuffer({ content, filepath: realpath })
  })
}

function initializeStyle() {
  const reloadStyles = (eventType, filename) => {
    if (eventType && eventType !== 'change')
      return
    return readFile(styleFile).then(buffer => {
      context.cssProvider.loadFromData(buffer, buffer.length)
      console.log('Styles loaded')
    })
  }

  styleFileWatcher = fs.watch(styleFile, reloadStyles)

  return reloadStyles()
}

function openFileDialog() {
  const dialog = new Gtk.FileChooserDialog(
    'Open File', context.mainWindow, Gtk.FileChooserAction.OPEN)
  dialog.addButton(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
  dialog.addButton(Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT)

  if (dialog.run() == Gtk.ResponseType.ACCEPT) {
    const filename = dialog.getFilename()
    setImmediate(() => loadFile(filename))
  }

  dialog.destroy()
}

function onExit() {
  if (onExit.didExit)
    return
  onExit.didExit = true
  console.log('Exiting gracefully...')

  if (styleFileWatcher) {
    styleFileWatcher.close()
    styleFileWatcher = null
  }
}

process.on('exit',    onExit)
process.on('SIGTERM', onExit)
process.on('SIGHUP',  onExit)

main()
