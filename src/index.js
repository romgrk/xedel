const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const chokidar = require('chokidar')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GdkX11 = gi.require('GdkX11', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const workspace = require('./workspace')

const grammars = require('./grammars')
const MainWindow = require('./window')
const EditorView = require('./editor-view')
const CommandsManager = require('./commands-manager')
const KeymapManager = require('./keymap-manager')

const getAbsolutePath = require('./utils/get-absolute-path')

const readFile = fs.promises.readFile

// Paths

const STYLE_FILE = path.join(__dirname, './style.css')


// Initialize

gi.startLoop()
Gtk.init([])
Gdk.init([])

const schemeManager = GtkSource.StyleSchemeManager.getDefault()
const langManager = GtkSource.LanguageManager.getDefault()

let styleFileWatcher

workspace.set({
  mainWindow: null,
  toolbar: null,
  statusbar: null,
  mainGrid: null,

  cssProvider: new Gtk.CssProvider(),
  schemeManager: schemeManager,
  langManager: langManager,
  scheme: schemeManager.getScheme('builder-dark'),

  commands: null,
  keymaps: null,

  currentView: null,
  buffers: [],
  cwd: process.cwd(),

  loadFile: loadFile,
})

workspace.loaded.then(() => {
  console.log('Loaded')
})

function main() {
  Gtk.StyleContext.addProviderForScreen(
    Gdk.Screen.getDefault(), workspace.cssProvider, 9999)

  const mainWindow = workspace.mainWindow = new MainWindow()

  const commands = workspace.commands = new CommandsManager()
  const keymaps = workspace.keymaps = new KeymapManager()
  keymaps.addListener((key, element, elements) => {
    console.log(chalk.grey('key-press'), key.toString())
    // elements.forEach(e => console.log('-> ', e.constructor.name))
  })

  Promise.all([
    initializeStyle(),
    grammars.loaded.then(() => loadFile('./static/example-javascript.js')),
  ])
  .then(() => {
    setImmediate(() => workspace.loaded.resolve())
    mainWindow.showAll()
  })
}

function loadFile(filepath) {
  console.log(`Loading "${filepath}"`)

  const realpath = getAbsolutePath(filepath, workspace.cwd)

  return readFile(realpath)
  .then(content => {
    workspace.currentView.openBuffer({ content, filepath: realpath })
  })
}

function initializeStyle() {
  const reloadStyles = (filename, stats) => {
    return readFile(STYLE_FILE).then(buffer => {
      workspace.cssProvider.loadFromData(buffer, buffer.length)
      console.log('Styles loaded')
    })
  }

  styleFileWatcher = chokidar.watch(STYLE_FILE)
  styleFileWatcher.on('change', reloadStyles)

  return reloadStyles()
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
