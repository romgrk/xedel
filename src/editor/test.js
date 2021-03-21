/*
 * test-editor.js
 */

const fs = require('fs')
const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const GdkX11 = gi.require('GdkX11', '4.0')
const GLib = gi.require('GLib', '2.0')

const workspace = require('../workspace')
const TextEditor = require('./index.js')

const grammars = require('../grammars')
require('../utils/cairo-prototype-extend')

// Initialize

gi.startLoop()
Gtk.init([])

const styles = `
  /* Style rules here */
`

function main() {
  const loop = GLib.MainLoop.new(null, false)
  const app = new Gtk.Application('com.github.romgrk.xedel', 0)

  app.on('activate', () => {
    // const filename = __filename
    // const filename = path.join(__dirname, 'content.js')
    const filename = path.join(__dirname, 'TextEditorComponent.js')

    const mainWindow = workspace.mainWindow = new Gtk.ApplicationWindow(app)
    const editor = TextEditor.create({
      text: fs.readFileSync(filename).toString(),
      filepath: filename,
    })
    mainWindow.setChild(editor)
    mainWindow.setDefaultSize(800, 800)
    const styleProvider = new Gtk.CssProvider()
    const styleContext = mainWindow.getStyleContext()
    styleContext.addProvider(styleProvider, 9999)
    styleProvider.loadFromData(styles, styles.length)

    mainWindow.on('destroy', () => process.exit(0))
    mainWindow.on('close-request', () => {
      loop.quit()
      process.exit(0)
    })
    mainWindow.on('show', () => {
      // workspace.emit('loaded')
    })
    mainWindow.show()
    loop.run()
  })

  Promise.all([
    grammars.loaded/*.then(() => loadFile('./src/editor/TextEditor.js'))*/,
  ])
  .then(() => { app.run() })
}

function onExit() {
  if (onExit.didExit)
    return
  onExit.didExit = true
  console.log('Exiting gracefully...')
}

process.on('exit',    onExit)
process.on('SIGTERM', onExit)
process.on('SIGHUP',  onExit)

main()
