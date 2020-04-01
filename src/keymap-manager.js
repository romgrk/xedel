/*
 * keymap-manager.js
 */

const context = require('./context')

const Key = require('./key')
const tryCall = require('./utils/try-call')
const { unreachable } = require('./utils/assert')

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const CONTINUE = false
const STOP_PROPAGATION = true

const MATCH = {
  PARTIAL: 'PARTIAL',
  FULL:    'FULL',
}

class KeymapManager {
  queuedEvents = []
  queuedKeystrokes = []

  keymapsByName = {}

  constructor() {
    context.loaded.then(() => {
      context.mainWindow.on('key-press-event', this.onWindowKeyPressEvent.bind(this))
    })
  }

  addKeymap(widget, keymap) {
    const name = widget.constructor.name

    if (this.keymapsByName[name] === undefined)
      this.keymapsByName[name] = []

    this.keymapsByName[name].push(keymap)
  }

  removeKeymap(widget, keymap) {
    const name = widget.constructor.name

    if (this.keymapsByName[name] === undefined)
      return

    this.keymapsByName[name] =
      this.keymapsByName[name].filter(k => k !== keymap)
  }

  onWindowKeyPressEvent(event) {
    const keyname = Gdk.keyvalName(event.keyval)
    const key = Key.fromEvent(event)

    const elements = getElementsStack()

    console.log('key-press', event.keyval, keyname, key.toString())
    // elements.forEach(e => console.log('-> ', e.constructor.name))

    const queuedKeystrokes = this.queuedKeystrokes.concat(key)

    for (let element of elements) {
      const keymaps = this.keymapsByName[element.constructor.name]

      if (!keymaps)
        continue

      // console.log({ name, keymaps })

      const matches =
        keymaps.map(keymap => matchKeybinding(queuedKeystrokes, keymap))
              .reduce((list, current) => list.concat(current), [])

      if (matches.length > 0)
        console.log('matches', matches)

      const fullMatch = matches.find(m => m.match === MATCH.FULL)

      if (fullMatch && matches.length === 1) {
        const { keys, effect, source } = fullMatch

        this.runEffect(effect, element)
        this.queuedEvents = []
        this.queuedKeystrokes = []

        return STOP_PROPAGATION
      }
      else if (matches.length > 0) {
        this.queuedEvents = this.queuedEvents.concat(event)
        this.queuedKeystrokes = queuedKeystrokes
      }
    }

    return CONTINUE
  }

  runEffect(effect, widget) {
    // console.log({ effect })

    if (typeof effect === 'string') {
      const command = context.commands.get(effect)
      effect = command.effect
    }

    if (typeof effect === 'function') {
      return effect(widget)
    }

    if (Array.isArray(effect)) {
      const [signalDetail, ...args] = effect
      widget.emit(signalDetail, ...args)
      return
    }

    unreachable()
  }
}

KeymapManager.MATCH = MATCH

module.exports = KeymapManager

function getElementsStack() {
  const activeElement = context.mainWindow.getFocus()
  const elements = [activeElement]
  let current = activeElement
  while ((current = current.getParent()) !== null) {
    elements.push(current)
  }

  return elements
}

function matchKeybinding(queuedKeystrokes, keymap) {
  const { name, keys } = keymap
  const keybindingKeys = Object.keys(keys)
  const results = []

  let match

  outer: for (let keybinding of keybindingKeys) {
    const keyStack = keybinding.split(/\s+/).map(d => Key.fromDescription(d))

    // console.log({ queuedKeystrokes, keyStack })

    if (keyStack.length < queuedKeystrokes.length)
      continue

    for (let i = 0; i < queuedKeystrokes.length; i++) {
      const key = queuedKeystrokes[i]

      if (!key.equals(keyStack[i]))
        continue outer
    }

    if (queuedKeystrokes.length < keyStack.length) {
      results.push({ match: MATCH.PARTIAL, keybinding, effect: keys[keybinding], source: name })
    }
    else if (keyStack.length === queuedKeystrokes.length) {
      results.push({ match: MATCH.FULL, keybinding, effect: keys[keybinding], source: name })
    }
    else {
      unreachable()
    }
  }

  return results
}
