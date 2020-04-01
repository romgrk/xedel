/*
 * key.js
 */

const nativeKeymap = require('native-keymap').getKeyMap()
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const { LOWER_TO_UPPER } = require('./key-symbols')

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

class Key {
  ctrl = false
  shift = false
  alt = false
  super = false
  name = undefined

  string = undefined
  event = undefined

  static fromEvent = (event) => {
    let shift = false
    let name = Gdk.keyvalName(event.keyval)
    let string = String.fromCharCode(Gdk.keyvalToUnicode(event.keyval))

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
    key.ctrl = event.ctrlKey
    key.shift = shift || event.shiftKey
    key.alt = event.altKey
    key.super = event.superKey
    key.name = name
    key.string = event.string
    key.event = event

    return key
  }

  static fromDescription = (description) => {
    const key = new Key()

    const parts = description.split('-')

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
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
        // key name, eg "grave"
        else {
          if (!isValidKeyvalName(name))
            throw new Error(`Couldn't parse key: "${description}"`)

          string = String.fromCharCode(Gdk.keyvalToUnicode(Gdk.keyvalFromName(name)))

          const keymapEntry = keymap.find(k => k.withShift === string)
          if (keymapEntry) {
            name = getKeyvalNameFromChar(keymapEntry.value)
            key.shift = true
          }
        }

        key.name = name
      }
      else {
        throw new Error(`Couldn't parse key: "${description}"`)
      }
    }

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
