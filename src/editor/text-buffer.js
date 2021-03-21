/*
 * buffer.js
 */

const AtomTextBuffer = require('text-buffer')

let nextBufferId = 1

class TextBuffer extends AtomTextBuffer {
  constructor(params) {
    super(params)
    this.bufferId = nextBufferId++
    this.changedTick = 0
    this.onDidChange(this.onChangedTick)
  }

  onChangedTick = () => {
    this.changedTick += 1
  }

  getName() {
    return this.getBaseName() || `[Buffer ${this.bufferId}]`
  }
}

module.exports = TextBuffer
