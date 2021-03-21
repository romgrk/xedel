const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const chokidar = require('chokidar')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const GdkX11 = gi.require('GdkX11', '4.0')
const GLib = gi.require('GLib', '2.0')

const workspace = require('./workspace')

const clipboard = require('./editor/clipboard')
const grammars = require('./grammars')
const MainWindow = require('./window')
const CommandsManager = require('./commands-manager')
const KeymapManager = require('./keymap-manager')

require('./utils/cairo-prototype-extend')
const getAbsolutePath = require('./utils/get-absolute-path')

const readFile = fs.promises.readFile

// Paths

const STYLE_FILE = path.join(__dirname, './style.css')


// Initialize

gi.startLoop()
Gtk.init([])

let styleFileWatcher

workspace.set({
  app: null,
  mainWindow: null,
  toolbar: null,
  statusbar: null,
  mainGrid: null,
  clipboard: clipboard,

  cssProvider: new Gtk.CssProvider(),

  commands: null,
  keymaps: null,

  currentView: null,
  buffers: [],
  cwd: process.cwd(),

  loadFile: loadFile,
})

workspace.loaded.then(() => {
  console.log('Workspace loaded')
})

function main() {
  const loop = GLib.MainLoop.new(null, false)
  const app = workspace.app = new Gtk.Application('com.github.romgrk.xedel', 0)

  app.on('activate', () => {
    const mainWindow = workspace.mainWindow = new MainWindow(app)
    Gtk.StyleContext.addProviderForDisplay(
      Gdk.Display.getDefault(),
      workspace.cssProvider,
      9999
    )
    mainWindow.on('close-request', () => {
      loop.quit()
      process.exit(0)
    })
    mainWindow.on('show', () => {
      workspace.emit('loaded')
    })
    mainWindow.show()
    loop.run()
  })


  const commands = workspace.commands = new CommandsManager()
  const keymaps = workspace.keymaps = new KeymapManager()

  keymaps.addListener((key, element, elements) => {
    // console.log(chalk.grey('key-press'), key.toString())
    // elements.forEach(e => console.log('-> ', e.constructor.name))
  })

  Promise.all([
    initializeStyle(),
    grammars.loaded/*.then(() => loadFile('./src/editor/TextEditor.js'))*/,
  ])
  .then(() => { app.run() })
}

function loadFile(filepath) {
  console.log(`Loading "${filepath}"`)

  const realpath = getAbsolutePath(filepath, workspace.cwd)

  return readFile(realpath)
  .then(buffer => buffer.toString())
  .then(text => {
    workspace.currentView.openBuffer({ text, filepath: realpath })
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
