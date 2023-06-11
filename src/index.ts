const fs = require('fs')
const path = require('path')
const Module = require('module')
const localStorage = require('localStorage')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Adw = gi.require('Adw', '1')

const Environment = require('./editor/atom-environment')
const ApplicationDelegate = require('./editor/application-delegate')
const Application = require('./application')
const FileSystemBlobStore = require('./editor/file-system-blob-store');
const TextEditor = require('./editor/text-editor')
const clipboard = require('./editor/clipboard')

const g = global as any
g.localStorage = localStorage

require('./utils/cairo-prototype-extend')
const getAbsolutePath = require('./utils/get-absolute-path')
const readFile = fs.promises.readFile

// Initialize

gi.startLoop()
Gtk.init([])

const userCacheHome  = process.env.XDG_CACHE_HOME  || `${process.env.HOME}/.cache`
const userConfigHome = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`

const cacheDirPath  = path.join(userCacheHome, 'xedel')
const configDirPath = path.join(userConfigHome, 'xedel')
const pluginsPath   = path.join(configDirPath, 'plugins')

// Add application-specific exports to module search path.
const exportsPath = path.join(__dirname, './node_modules');
Module.globalPaths.push(exportsPath);
process.env.NODE_PATH = exportsPath

process.env.ATOM_HOME = configDirPath
process.env.XEDEL_HOME = configDirPath

const blobStore = FileSystemBlobStore.load(
  path.join(process.env.XEDEL_HOME, 'blob-store')
);

async function main() {
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

  // TextEditor.setScheduler(global.atom.views);
  global.atom.preloadPackages();

  loadPluginsFromPath(pluginsPath)
  loadPluginsFromPath(path.join(__dirname, '../default-packages'))

  xedel.app = new Application(window => {

    const styleManager = xedel.app.getStyleManager()
    styleManager.colorScheme = Adw.ColorScheme.PREFER_DARK

    xedel.initialize({
      window,
      // document,
      blobStore,
      configDirPath,
      cacheDirPath,
      env: process.env,
    });

    require('./window').register()
    require('./editor/keymap').register()

    xedel.loadedResolve()
    xedel.startEditorWindow().then(() => {
      setTimeout(() => xedel.workspace.getElement().grabFocus(), 100)

      //ipcRenderer.on('environment', (event, env) => updateProcessEnv(env));
    })
  })
  xedel.app.run()
}

function loadPluginsFromPath(pluginsPath) {
  const plugins = fs.readdirSync(pluginsPath)

  plugins.forEach(pluginName => {
    xedel.packages.loadPackage(path.join(pluginsPath, pluginName))
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

main()
