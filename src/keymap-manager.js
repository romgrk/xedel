/*
 * keymap-manager.js
 */

const xedel = require('./globals')

const Key = require('./key')
const { unreachable } = require('./utils/assert')

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const CONTINUE = false
const STOP_PROPAGATION = true

const MATCH = {
  PARTIAL: 'PARTIAL',
  FULL:    'FULL',
}

class KeymapManager {
  listeners = []

  queuedKeystrokes = []

  keymapsByName = {}

  constructor() {
    xedel.loaded.then(() => {
      this.controller = new Gtk.EventControllerKey()
      this.controller.setPropagationPhase(Gtk.PropagationPhase.CAPTURE)
      this.controller.on('key-pressed', this.onWindowKeyPressEvent)
      xedel.mainWindow.addController(this.controller)
    })
  }

  addListener(listener) {
    this.listeners.push(listener)
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  addKeymap(element, keymap) {
    const name = element.name || element.constructor.name || element

    if (this.keymapsByName[name] === undefined)
      this.keymapsByName[name] = []

    this.keymapsByName[name].push(keymap)
  }

  removeKeymap(element, keymap) {
    const name = element.name || element.constructor.name || element

    if (this.keymapsByName[name] === undefined)
      return

    this.keymapsByName[name] =
      this.keymapsByName[name].filter(k => k !== keymap)
  }

  onWindowKeyPressEvent = (keyval, keycode, state) => {
    const keyname = Gdk.keyvalName(keyval)
    const key = Key.fromArgs(keyval, keycode, state)

    const elements = getElementsStack()

    for (let listener of this.listeners) {
      if (listener(key, elements[0], elements) === STOP_PROPAGATION)
        return STOP_PROPAGATION
    }

    if (key.isModifier())
      return CONTINUE

    const keystrokes = this.queuedKeystrokes.concat(key)
    const matches = []

    for (let element of elements) {
      const keymaps = this.keymapsByName[element.constructor.name]

      if (!keymaps)
        continue

      matches.push(
        ...keymaps.map(keymap => matchKeybinding(keystrokes, keymap, element))
                  .reduce((list, current) => list.concat(current), []))
    }

    let didCapture = false
    let shouldStopPropagation = true

    const fullMatch = matches.find(m => m.match === MATCH.FULL)

    if (fullMatch && matches.length === 1) {
      const { keybinding, effect, source, element } = fullMatch
      const keymap = this.keymapsByName[element.constructor.name].find(k => k.name === source)

      console.log(`${element.constructor.name}.${source}: [${keybinding}]: ${effect}`)

      this.runEffect(effect, element)
      this.queuedKeystrokes = []

      didCapture = true
      shouldStopPropagation =
        keymap.options && ('preventPropagation' in keymap.options) ?
          keymap.options.preventPropagation : true
    }
    else if (matches.length > 0) {
      this.queuedKeystrokes = keystrokes

      didCapture = true
    }
    else {
      this.queuedKeystrokes = []
    }

    return (
      didCapture && shouldStopPropagation ?
        STOP_PROPAGATION :
        CONTINUE
    )
  }

  runEffect(effect, element) {
    // console.log({ effect })

    if (typeof effect === 'string') {
      const command = xedel.commands.get(effect)
      effect = command.effect
    }

    if (typeof effect === 'function') {
      return effect.call(element, element)
    }

    if (Array.isArray(effect)) {
      const [signalDetail, ...args] = effect
      element.emit(signalDetail, ...args)
      return
    }

    console.log({ effect, element })
    unreachable()
  }
}

KeymapManager.MATCH = MATCH

module.exports = KeymapManager

function getElementsStack() {
  const activeElement = xedel.mainWindow.getFocus()
  if (!activeElement)
    return []
  const elements = [activeElement]
  let current = activeElement
  while (current && (current = current.getParent()) !== null) {
    elements.push(current)
  }

  return elements
}

function matchKeybinding(queuedKeystrokes, keymap, element) {
  const { name, keys } = keymap
  const keybindingKeys = Object.keys(keys)
  const results = []

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
      results.push({
        match: MATCH.PARTIAL,
        keybinding,
        effect: keys[keybinding],
        source: name,
        element
      })
    }
    else if (keyStack.length === queuedKeystrokes.length) {
      results.push({
        match: MATCH.FULL,
        keybinding,
        effect: keys[keybinding],
        source: name,
        element
      })
    }
    else {
      unreachable()
    }
  }

  return results
}
