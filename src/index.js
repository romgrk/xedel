const fs = require('fs')
const path = require('path')
const CSON = require('season')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const GdkX11 = gi.require('GdkX11', '4.0')
const GLib = gi.require('GLib', '2.0')

const xedel = require('./globals')

const Application = require('./application')
const Config = require('./editor/config')
const GrammarRegistry = require('./editor/grammar-registry')
const CommandsManager = require('./commands-manager')
const KeymapManager = require('./keymap-manager')
const TreeSitterGrammar = require('./editor/tree-sitter-grammar')
const clipboard = require('./editor/clipboard')
// const grammars = require('./grammars')

require('./utils/cairo-prototype-extend')
const getAbsolutePath = require('./utils/get-absolute-path')
const readFile = fs.promises.readFile

// Initialize

gi.startLoop()
Gtk.init([])

xedel.set({
  app: null,
  mainWindow: null,
  toolbar: null,
  statusbar: null,
  mainGrid: null,

  cssProvider: new Gtk.CssProvider(),

  clipboard: clipboard,

  commands: null,
  keymaps: null,
  gramars: null,
  config: null,

  currentView: null,
  buffers: [],
  cwd: process.cwd(),

  loadFile: loadFile,
})

xedel.loaded.then(() => {
  console.log('Workspace loaded')
})

const userConfigHome = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`
const configPath = path.join(userConfigHome, 'xedel')
const pluginsPath = path.join(configPath, 'plugins')

function main() {
  const app = xedel.app = new Application()

  xedel.config = new Config()
  xedel.commands = new CommandsManager()
  xedel.keymaps = new KeymapManager()
  xedel.grammars = new GrammarRegistry({ config: xedel.config })

  const plugins = fs.readdirSync(pluginsPath)
  plugins.forEach(pluginName => {
    // FIXME: handle disposables inside here
    console.log('Loading ' + pluginName)
    const pluginPath = path.join(pluginsPath, pluginName)
    const plugin = require(pluginPath)
    const grammarsPath = path.join(pluginPath, 'grammars')
    const grammarPaths =
      fs.existsSync(grammarsPath) ?
        fs.readdirSync(grammarsPath).map(p => path.join(grammarsPath, p)) : []

    grammarPaths.forEach(grammarPath => {
      // FIXME: this line
      if (!grammarPath.includes('tree-sitter'))
        return
      const params = CSON.parse(fs.readFileSync(grammarPath))
      const grammar = new TreeSitterGrammar(xedel.grammars, grammarPath, params)
      grammar.activate()
      console.log('==> Added grammar ' + params.name)
    })

    if (plugin.activate)
      plugin.activate()
    console.log('==> Loaded ' + pluginName)
  })


  app.run()
}

function loadFile(filepath) {
  console.log(`Loading "${filepath}"`)
  const realpath = getAbsolutePath(filepath, xedel.cwd)
  return readFile(realpath)
  .then(buffer => buffer.toString())
  .then(text => {
    xedel.currentView.openBuffer({ text, filepath: realpath })
  })
}

function onExit() {
  if (onExit.didExit)
    return
  onExit.didExit = true
  xedel.app.exit()
  console.log('Exiting gracefully...')
}

process.on('exit',    onExit)
process.on('SIGTERM', onExit)
process.on('SIGHUP',  onExit)

main()
