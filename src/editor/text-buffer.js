/*
 * buffer.js
 */

const AtomTextBuffer = require('text-buffer')

let nextBufferId = 1

class TextBuffer extends AtomTextBuffer {
  constructor(params) {
    super(params)
    this.bufferId = nextBufferId++
  }

  getName() {
    return this.getBaseName() || `[Buffer ${this.bufferId}]`
  }
}

module.exports = TextBuffer
