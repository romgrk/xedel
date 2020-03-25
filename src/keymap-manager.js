/*
 * keymap-manager.js
 */

const context = require('./context')

const tryCall = require('./utils/try-call')
const { unreachable } = require('./utils/assert')

const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')

const CONTINUE = false
const STOP_PROPAGATION = true

const KeybindingMatch = {
  NONE:    'NONE',
  PARTIAL: 'PARTIAL',
  FULL:    'FULL',
}

class KeymapManager {
  stack = []
  keymapByLayer = {}

  constructor() {
    context.loaded.then(() => {
      context.mainWindow.on('key-press-event', this.onWindowKeyPressEvent.bind(this))
    })
  }

  addKeymap(widget, keymap) {
    const name = keymap.name

    widget.on('key-press-event', (event) =>
      tryCall(() => this.onKeyPressEvent(name, widget, event)))

    if (this.keymapByLayer[name] === undefined)
      this.keymapByLayer[name] = []

    this.keymapByLayer[name].push(keymap)
  }

  onWindowKeyPressEvent(event) {
    const keyname = Gdk.keyvalName(event.keyval)
    const description = getEventKeyDescription(event)
    console.log('key-press', 'TOP_LEVEL', event.keyval, keyname, description)
  }

  onKeyPressEvent(name, widget, event) {
    const keyname = Gdk.keyvalName(event.keyval)
    const description = getEventKeyDescription(event)
    const key = Key.fromDescription(description, event)

    console.log('key-press', widget.constructor.name, event.keyval, keyname, description)
    // return

    const currentStack = this.stack.concat(key)

    const keymaps = this.keymapByLayer[name]

    // console.log({ name, keymaps })

    const matches =
      keymaps.map(keymap => matchKeybinding(currentStack, keymap))
             .reduce((list, current) => list.concat(current), [])

    if (matches.length > 0)
      console.log('matches', matches)

    const fullMatch = matches.find(m => m.match === KeybindingMatch.FULL)

    if (fullMatch && matches.length === 1) {
      const { keybinding, effect, source } = fullMatch

      this.runEffect(effect, widget)
      this.stack = []

      return STOP_PROPAGATION
    }
    else if (matches.length > 0) {
      this.stack = currentStack
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

KeymapManager.KeybindingMatch = KeybindingMatch

module.exports = KeymapManager

class Key {
  ctrl = false
  shift = false
  alt = false
  super = false
  value = undefined

  event = undefined
  description = undefined

  static fromDescription = (description, event) => {
    const key = new Key(description, event)

    const parts = description.split('+')

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (part === 'Ctrl') {
        key.ctrl = true
      }
      else if (part === 'Shift') {
        key.shift = true
      }
      else if (part === 'Alt') {
        key.alt = true
      }
      else if (part === 'Super') {
        key.super = true
      }
      else if (part === 'Mod4') {
        // ignore
      }
      else if (i === parts.length - 1) {
        key.value = part
      }
    }

    return key
  }

  constructor(description, event) {
    this.description = description
    if (event) {
      this.event = event
    }
  }

  equals(other) {
    if (this.ctrl !== other.ctrl) return false
    if (this.shift !== other.shift) return false
    if (this.alt !== other.alt) return false
    if (this.super !== other.super) return false

    if (this.value === other.value) return true

    return false
  }

  isLetter() {
    return /^[a-zA-Z]$/.test(this.value)
  }

  isDigit() {
    return /^[0-9]$/.test(this.value)
  }
}

function matchKeybinding(stack, keymap) {
  const { name, keybindings } = keymap
  const keybindingKeys = Object.keys(keybindings)
  const results = []

  let match

  outer: for (let keybinding of keybindingKeys) {
    const keyStack = keybinding.split(/\s+/).map(d => Key.fromDescription(d))

    // console.log({ stack, keyStack })

    if (keyStack.length < stack.length)
      continue

    for (let i = 0; i < stack.length; i++) {
      const key = stack[i]

      if (!key.equals(keyStack[i]))
        continue outer
    }

    if (stack.length < keyStack.length) {
      results.push({ match: KeybindingMatch.PARTIAL, keybinding, effect: keybindings[keybinding], source: name })
    }
    else if (keyStack.length === stack.length) {
      results.push({ match: KeybindingMatch.FULL, keybinding, effect: keybindings[keybinding], source: name })
    }
    else {
      unreachable()
    }
  }

  return results
}

function getEventKeyDescription(event) {
  const label = Gtk.acceleratorGetLabel(event.keyval, event.state)
  return label
    .replace('Left Tab', 'Tab')
    .replace(/ /g, '_')
}
