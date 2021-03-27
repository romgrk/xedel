/*
 * keymap-manager.js
 */

const { Disposable } = require('event-kit')

const Key = require('./key')
const { unreachable } = require('./utils/assert')
const { translateSelector } = require('./utils/atom-compatibility')

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
  keymapsBySource = {}

  initialize() {
    this.controller = new Gtk.EventControllerKey()
    this.controller.setPropagationPhase(Gtk.PropagationPhase.CAPTURE)
    this.controller.on('key-pressed', this.onWindowKeyPressEvent)
    xedel.window.addController(this.controller)
  }

  addListener(listener) {
    this.listeners.push(listener)
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }
  // add: (source, keyBindingsBySelector, priority=0, throwOnInvalidSelector=true)
  add(source, keymapBySelector, priority = 0, throwOnInvalidSelector = true) {
    Object.keys(keymapBySelector).forEach(name => {
      const keymap = keymapBySelector[name]
      const selector = translateSelector(name)

      if (this.keymapsByName[selector] === undefined)
        this.keymapsByName[selector] = []

      this.keymapsByName[selector].push(keymap)
    })

    this.keymapsBySource[source] = keymapBySelector

    return new Disposable(() => {
      this.removeBindingsFromSource(source)
    })
  }

  removeBindingsFromSource(source) {
    const keymapBySelector = this.keymapsBySource[source]

    if (!keymapBySelector)
      return

    Object.keys(keymapBySelector).forEach(name => {
      const keymap = keymapBySelector[name]
      const selector = translateSelector(name)

      if (this.keymapsByName[selector] === undefined)
        return

      this.keymapsByName[selector] =
        this.keymapsByName[selector].filter(k => k !== keymap)
    })
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
    let commandName

    if (typeof effect === 'string') {
      commandName = effect
      const command = xedel.commands.get(element.constructor.name, effect)
      effect = command.effect
    }

    if (typeof effect === 'function') {
      return effect.call(element, element)
    }

    if (typeof effect === 'object' && typeof effect.didDispatch === 'function') {
      const event = new CommandEvent(commandName)
      return effect.didDispatch.call(element, event)
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
  const activeElement = xedel.window.getFocus()
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
  const keybindingKeys = Object.keys(keymap)
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
        effect: keymap[keybinding],
        // source: name, // FIXME this
        element
      })
    }
    else if (keyStack.length === queuedKeystrokes.length) {
      results.push({
        match: MATCH.FULL,
        keybinding,
        effect: keymap[keybinding],
        // source: name, // FIXME this
        element
      })
    }
    else {
      unreachable()
    }
  }

  return results
}

class CommandEvent {
  stopPropagationCalled = false

  constructor(type) {
    this.type = type
  }

  stopPropagation() {
    this.stopPropagationCalled = true
  }
}
