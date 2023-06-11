/*
 * application.js
 */

const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const gi = require('node-gtk')
const Adw = gi.require('Adw', '1')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const GLib = gi.require('GLib', '2.0')
const readFile = fs.promises.readFile

const MainWindow = require('./window')

const STYLE_FILE = path.join(__dirname, './style.css')

let styleFileWatcher
let _callback

class Application extends Adw.Application {
  constructor(callback) {
    super('com.github.romgrk.xedel', 0)
    // FIXME: node-gtk issue: setting a property will make `new Window()`
    // think that we're passing it an initialize props object rather than
    // a GtkApplication object.
    _callback = callback
    this.on('activate', () => this.onActivate())
  }

  onActivate() {
    Gtk.StyleContext.addProviderForDisplay(
      Gdk.Display.getDefault(),
      xedel.cssProvider,
      900
    )

    Promise.all([
      initializeStyle(),
      // grammars.loaded[>.then(() => loadFile('./src/editor/TextEditor.js'))<],
    ])
    .then(() => {})

    const mainWindow = new MainWindow(this)
    mainWindow.on('close-request', () => {
      this.loop.quit()
      process.exit(0)
    })
    mainWindow.on('show', () => {
      _callback(mainWindow)
    })
    mainWindow.show()
    this.loop = GLib.MainLoop.new(null, false)
    this.loop.run()
  }

  exit() {
    if (styleFileWatcher) {
      styleFileWatcher.close()
      styleFileWatcher = null
    }
  }
}

function initializeStyle() {
  const reloadStyles = (filename, stats) => {
    return readFile(STYLE_FILE).then(buffer => {
      xedel.cssProvider.loadFromData(buffer, buffer.length)
      console.log('Styles loaded')
    })
  }

  styleFileWatcher = chokidar.watch(STYLE_FILE)
  styleFileWatcher.on('change', reloadStyles)

  return reloadStyles()
}


module.exports = Application
