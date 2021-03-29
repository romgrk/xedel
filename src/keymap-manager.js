/*
 * keymap-manager.js
 */

const { Disposable } = require('event-kit')

const Key = require('./key')
const { unreachable } = require('./utils/assert')
const { parseSelector, matchesRule } = require('./utils/selectors')

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const EVENT_CONTINUE         = false
const EVENT_STOP_PROPAGATION = true

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
    Object.keys(keymapBySelector).forEach(selector => {

      const keymap = keymapBySelector[selector]
      const rules = parseSelector(selector)

      console.log(rules)

      rules.forEach(rule => {
        const elementName = rule.element
        if (this.keymapsByName[elementName] === undefined)
          this.keymapsByName[elementName] = []
        this.keymapsByName[elementName].push({ rule, keymap })
      })
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

    Object.keys(keymapBySelector).forEach(selector => {
      const keymap = keymapBySelector[selector]
      const rules = parseSelector(selector)

      rules.forEach(rule => {
        const elementName = rule.element
        this.keymapsByName[elementName] =
          this.keymapsByName[elementName].filter(k => k.keymap !== keymap)
      })
    })

    delete this.keymapsBySource[source]
  }

  onWindowKeyPressEvent = (keyval, keycode, state) => {
    const key = Key.fromArgs(keyval, keycode, state)

    const elements = getElementsStack()

    for (let listener of this.listeners) {
      if (listener(key, elements[0], elements) === EVENT_STOP_PROPAGATION)
        return EVENT_STOP_PROPAGATION
    }

    if (key.isModifier())
      return EVENT_CONTINUE

    const keystrokes = this.queuedKeystrokes.concat(key)
    const matches = []

    for (let element of elements) {
      const keymaps = this.keymapsByName[element.constructor.name]

      if (!keymaps)
        continue

      const matchingKeymaps = keymaps.filter(k => matchesRule(element, k.rule))
      const matchingKeybindings =
        matchingKeymaps.map(k => matchKeybinding(keystrokes, k.keymap, element)).flat()

      if (matchingKeybindings.length === 0)
        continue

      matches.push(...matchingKeybindings)
    }

    let didCapture = false
    let shouldStopPropagation = true

    const fullMatches = matches.filter(m => m.match === MATCH.FULL)

    if (fullMatches.length > 0) {
      for (const fullMatch of fullMatches) {
        const { keybinding, effect, element } = fullMatch

        const didDispatch = xedel.commands.dispatch(element, effect)
        if (!didDispatch)
          continue

        console.log(`${element.constructor.name}: [${keybinding}]: ${effect}`)

        this.queuedKeystrokes = []
        didCapture = true
        shouldStopPropagation = true
        break
      }
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
        EVENT_STOP_PROPAGATION :
        EVENT_CONTINUE
    )
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
