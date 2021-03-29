/*
 * key.js
 */

const KeySymbols = require('./key-symbols')
const nativeKeymap = require('native-keymap').getKeyMap()
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')

const keymap =
  Object.entries(nativeKeymap)
    .filter(([name, description]) => !name.startsWith('Numpad'))
    .map(([name, description]) => ({ name, ...description }))

const getKeyvalNameFromChar = c =>
  Gdk.keyvalName(Gdk.unicodeToKeyval(c.charCodeAt(0)))

const isDigit = code =>
  code >= 0x30 && code <= 0x39

const isLetter = code =>
  (code >= 0x41 && code <= 0x5a) ||
  (code >= 0x61 && code <= 0x7a)

const isValidKeyvalName = name =>
  Gdk.keyvalName(Gdk.keyvalFromName(name)) === name


const keyByDescription = new Map()

class Key {
  ctrl = false
  shift = false
  alt = false
  cmd = false
  super = false
  name = undefined

  string = undefined
  event = undefined

  static fromArgs = (keyval, keycode, state) => {
    let shift = false
    let name = Gdk.keyvalName(keyval)
    let string = String.fromCharCode(Gdk.keyvalToUnicode(keyval))

    if (name in KeySymbols.CORRECTIONS)
      name = KeySymbols.CORRECTIONS[name]

    const keymapEntry =
      string.charCodeAt(0) >= 0x20 ?
        keymap.find(k => k.withShift === string) : undefined

    if (keymapEntry) {
      name = keymapEntry.value
      shift = true
    }
    // eg "Escape", "BackSpace"
    else {
      name = name.toLowerCase()
    }

    const key  = new Key()
    key.ctrl   = Boolean(state & Gdk.ModifierType.CONTROL_MASK)
    key.shift  = shift || Boolean(state & Gdk.ModifierType.SHIFT_MASK)
    key.alt    = Boolean(state & Gdk.ModifierType.ALT_MASK)
    key.cmd    = false // FIXME
    key.super  = Boolean(state & Gdk.ModifierType.SUPER_MASK)
    key.name   = name
    key.string = string
    key.event  = { keyval, keycode, state }

    return key
  }

  static fromEvent = (event) => {
    let shift = false
    let name = Gdk.keyvalName(event.keyval)
    let string = String.fromCharCode(Gdk.keyvalToUnicode(event.keyval))

    if (name in KeySymbols.CORRECTIONS)
      name = KeySymbols.CORRECTIONS[name]

    const keymapEntry =
      string.charCodeAt(0) >= 0x20 ?
        keymap.find(k => k.withShift === string) : undefined

    if (keymapEntry) {
      name = keymapEntry.value
      shift = true
    }
    // eg "Escape", "BackSpace"
    else {
      name = name.toLowerCase()
    }

    const key = new Key()
    key.cmd = false // FIXME
    key.ctrl = event.ctrlKey
    key.shift = shift || event.shiftKey
    key.alt = event.altKey
    key.super = event.superKey
    key.name = name
    key.string = event.string
    key.event = event

    Object.freeze(key)
    return key
  }

  static fromDescription = (description) => {
    const cachedKey = keyByDescription.get(description)
    if (cachedKey !== undefined)
      return cachedKey

    const key = new Key()

    const parts = description.split('-')

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i]
      if (part === '') {
        part = '-'
        i += 1
      }

      if (part in KeySymbols.CORRECTIONS)
        part = KeySymbols.CORRECTIONS[part]

      const lcPart = part.toLowerCase()

      if (lcPart === 'ctrl') {
        key.ctrl = true
      }
      else if (lcPart === 'shift') {
        key.shift = true
      }
      else if (lcPart === 'alt') {
        key.alt = true
      }
      else if (lcPart === 'cmd') {
        key.cmd = true
      }
      else if (lcPart === 'super') {
        key.super = true
      }
      else if (i === parts.length - 1) {
        let name = part
        let string = part

        const keymapEntry = keymap.find(k => k.withShift === string)
        if (keymapEntry) {
          name = keymapEntry.value
          key.shift = true
        }

        // key value, eg "a", "A", "!"
        if (name.length === 1) {
          const code = name.charCodeAt(0)

          if (!isLetter(code) && !isDigit(code)) {
            name = getKeyvalNameFromChar(name)
          }

        }
        // key name, eg "grave", "Escape", "escape"
        else {
          if (!isValidKeyvalName(name) && !KeySymbols.LOWER_TO_UPPER[name.toLowerCase()]) {
            console.warn(`Couldn't parse key: "${description}"`)
            keyByDescription.set(description, null)
            return null
          }

          string = String.fromCharCode(Gdk.keyvalToUnicode(Gdk.keyvalFromName(name)))
          name = name.toLowerCase()

          const keymapEntry =
            string.charCodeAt(0) >= 0x20 ?
              keymap.find(k => k.withShift === string) : undefined

          if (keymapEntry) {
            name = getKeyvalNameFromChar(keymapEntry.value)
            key.shift = true
          }
        }

        key.name = name
      }
      else {
        console.warn(`Couldn't parse key: "${description}"`)
        keyByDescription.set(description, null)
        return null
      }
    }

    Object.freeze(key)
    keyByDescription.set(description, key)
    return key
  }

  equals(other) {
    if (this.ctrl !== other.ctrl) return false
    if (this.shift !== other.shift) return false
    if (this.alt !== other.alt) return false
    if (this.super !== other.super) return false
    if (this.name !== other.name) return false
    return true
  }

  isLetter() {
    return /^[a-zA-Z]$/.test(this.name)
  }

  isDigit() {
    return /^[0-9]$/.test(this.name)
  }

  isModifier() {
    return KeySymbols.MODIFIERS.has(this.name)
  }

  toString() {
    return [
      this.super ? 'super' : undefined,
      this.ctrl ? 'ctrl' : undefined,
      this.alt ? 'alt' : undefined,
      this.shift ? 'shift' : undefined,
      this.name,
    ]
    .filter(Boolean)
    .join('-')
  }
}


module.exports = Key
