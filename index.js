const fs = require('fs')
const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const GtkSource = gi.require('GtkSource', '4')

const readFile = fs.promises.readFile

gi.startLoop()
Gtk.init([])
Gdk.init([])

const gladeFile = path.join(__dirname, './ui.glade')
const styleFile = path.join(__dirname, './style.css')

let styleFileWatcher

const builder = Gtk.Builder.newFromFile(gladeFile)

const schemeManager = GtkSource.StyleSchemeManager.getDefault()
const langManager = GtkSource.LanguageManager.getDefault()
const scheme = schemeManager.getScheme('oblivion')

const cssProvider = new Gtk.CssProvider()

const state = {
  mainWindow: null,
  header: null,
  mainGrid: null,
  currentView: null,
  buffers: [],
  cwd: process.cwd(),
}

function main() {

  const mainWindow = state.mainWindow = builder.getObject('mainWindow')
  const mainGrid = state.mainGrid = builder.getObject('mainGrid')
  const header = state.header = builder.getObject('helloLabel')

  builder.connectSignals({
    onWindowShow: Gtk.main,
    onWindowDestroy: () => {
      Gtk.mainQuit()
      process.exit(0)
    },
    onCloseBtnClicked: function () {
      mainWindow.close()
      console.log('window closed')
    },
    onActionBtnClicked: function () {
      console.log('button clicked')
    }
  })

  state.currentView = createView()

  mainGrid.attach(state.currentView, 0, 0, 1, 1)

  mainWindow.setDefaultSize(800, 800)

  mainWindow.on('key-press-event', onKeyPressEvent);

  Promise.all([
    initializeStyle(),
    updateBufferList(),
    loadFile('index.js'),
  ])
  .then(() => {
    mainWindow.showAll()
  })
}

function onKeyPressEvent(event) {
  const keyname = Gdk.keyvalName(event.keyval);
  const label = Gtk.acceleratorGetLabel(event.keyval, event.state);

  console.log(event, event.keyval, keyname, label)

  if (event.ctrlKey && event.keyval === Gdk.KEY_o) {
    setImmediate(openFileDialog)
    return true;
  }

  return false;
}

function loadFile(filepath) {
  console.log('Loading:', filepath)

  const realpath =
    path.isAbsolute(filepath) ?
      filepath :
      path.join(state.cwd, filepath)

  return readFile(realpath)
  .then(buffer => buffer.toString())
  .then(content => {
    const buffer = state.currentView.sourceView.getBuffer()
    const language = langManager.guessLanguage(realpath, null) || langManager.guessLanguage('file.js', null);

    buffer.text = content
    buffer.language = language
    buffer.filepath = realpath
    buffer.name = path.basename(realpath)

    updateBufferList()
  })
}

function updateBufferList() {
  state.header.setText(
    state.buffers.map(b => b.name).join(', ')
  )
}

function initializeStyle() {
  const reloadStyles = (eventType, filename) => {
    if (eventType && eventType !== 'change')
      return
    return readFile(styleFile).then(buffer => {
      cssProvider.loadFromData(buffer, buffer.length)
      console.log('Styles loaded')
    })
  }

  styleFileWatcher = fs.watch(styleFile, reloadStyles)

  return reloadStyles()
}

function openFileDialog() {
  const dialog = new Gtk.FileChooserDialog(
    'Open File', state.mainWindow, Gtk.FileChooserAction.OPEN)
  dialog.addButton(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
  dialog.addButton(Gtk.STOCK_OPEN, Gtk.ResponseType.ACCEPT)

  if (dialog.run() == Gtk.ResponseType.ACCEPT) {
    const filename = dialog.getFilename()
    setImmediate(() => loadFile(filename))
  }

  dialog.destroy()
}

let bufferId = 1
function createView() {
  const scrollView = new Gtk.ScrolledWindow()
  const sourceView   = new GtkSource.View()
  scrollView.add(sourceView)
  scrollView.margin = 10
  scrollView.sourceView = sourceView

  sourceView.vexpand = true
  sourceView.hexpand = true
  sourceView.monospace = true
  sourceView.showLineNumbers = true
  sourceView.highlightCurrentLine = true
  // sourceView.pixelsAboveLines = 10
  // sourceView.pixelsBelowLines = 10
  sourceView.getStyleContext().addProvider(cssProvider, 9999)

  const buffer = sourceView.getBuffer()
  buffer.highlightSyntax = true
  buffer.styleScheme = scheme
  buffer.name = `[Buffer ${bufferId++}]`

  state.buffers.push(buffer)

  return scrollView
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
