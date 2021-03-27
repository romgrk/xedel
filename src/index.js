const fs = require('fs')
const path = require('path')
const Module = require('module')
const CSON = require('season')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const GdkX11 = gi.require('GdkX11', '4.0')

const Environment = require('./editor/atom-environment')
const ApplicationDelegate = require('./editor/application-delegate')
const Application = require('./application')
const TextEditor = require('./editor/text-editor')
const TreeSitterGrammar = require('./editor/tree-sitter-grammar')
const clipboard = require('./editor/clipboard')
// const grammars = require('./grammars')

require('./utils/cairo-prototype-extend')
const getAbsolutePath = require('./utils/get-absolute-path')
const readFile = fs.promises.readFile

// Initialize

gi.startLoop()
Gtk.init([])

const userConfigHome = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`
const configDirPath = path.join(userConfigHome, 'xedel')
const pluginsPath   = path.join(configDirPath, 'plugins')

// Add application-specific exports to module search path.
const exportsPath = path.join(__dirname, './node_modules');
Module.globalPaths.push(exportsPath);
process.env.NODE_PATH = exportsPath

process.env.ATOM_HOME = configDirPath

function main() {
  TextEditor.setClipboard(clipboard);
  TextEditor.viewForItem = item => xedel.views.getView(item);

  const xedel = global.xedel = global.atom = new Environment({
    clipboard,
    applicationDelegate: new ApplicationDelegate(),
    enablePersistence: true
  });

  Object.assign(xedel, {
    cssProvider: new Gtk.CssProvider(),
    clipboard: clipboard,
    loadFile: loadFile,
  })

  loadPluginsFromPath(pluginsPath)
  loadPluginsFromPath(path.join(__dirname, './packages'))

  xedel.app = new Application(window => {
    // TextEditor.setScheduler(global.atom.views);
    // global.atom.preloadPackages();

    // const { updateProcessEnv } = require('./update-process-env');
    // const path = require('path');
    // require('./window');
    // const getWindowLoadSettings = require('./get-window-load-settings');
    // const { ipcRenderer } = require('electron');
    // const { resourcePath, devMode } = getWindowLoadSettings();
    // require('./electron-shims');

    global.xedel.initialize({
      window,
      // document,
      // blobStore,
      configDirPath,
      env: process.env
    });

    require('./window').register()
    require('./editor-view').register()
    require('./editor/keymap').register()

    // return global.atom.startEditorWindow().then(function() {
    //   // Workaround for focus getting cleared upon window creation
    //   const windowFocused = function() {
    //     window.removeEventListener('focus', windowFocused);
    //     setTimeout(() => document.querySelector('atom-workspace').focus(), 0);
    //   };
    //   window.addEventListener('focus', windowFocused);

    //   ipcRenderer.on('environment', (event, env) => updateProcessEnv(env));
    // });

    xedel.loadedResolve()
    xedel.startEditorWindow()
  })
  xedel.app.run()
}

function loadPluginsFromPath(pluginsPath) {
  const plugins = fs.readdirSync(pluginsPath)

  plugins.forEach(pluginName => {
    // FIXME: handle disposables inside here
    console.log('Loading ' + pluginName)
    const pluginPath = path.join(pluginsPath, pluginName)
    const plugin = require(pluginPath)
    const pluginPackage = require(path.join(pluginPath, 'package.json'))

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

    const keymapsPath = path.join(pluginPath, 'keymaps')
    const keymapPaths =
      fs.existsSync(keymapsPath) ?
        fs.readdirSync(keymapsPath).map(p => path.join(keymapsPath, p)) : []
    keymapPaths.forEach(keymapPath => {
      if (!keymapPath.endsWith('.cson'))
        return
      const keymap = CSON.parse(fs.readFileSync(keymapPath))
      xedel.keymaps.add(keymapPath, keymap)
      console.log('==> Added keymap ' + path.basename(keymapPath))
    })

    if (plugin.config) {
      xedel.config.setSchema(pluginPackage.name, {
        type: 'object',
        properties: plugin.config,
      })
    }

    if (plugin.activate)
      plugin.activate()

    console.log('==> Loaded ' + pluginName)
  })
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
