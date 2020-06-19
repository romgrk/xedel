/*
 * Cursor.js
 */

class Cursor {
  row = 0
  column = 0
  columnWanted = 0
  editor = null

  constructor(row, column, editor) {
    this.row = row
    this.column = column
    this.editor = editor
  }

  get buffer() {
    return this.editor.getBuffer()
  }

  getScreenPosition() {
    return this
  }

  moveUp(rowCount = 1) {
    this.row -= rowCount
    if (this.row < 0)
      this.row = 0
    const line = this.buffer.lineForRow(this.row)
    if (this.column > line.length) {
      this.columnWanted = Math.max(this.columnWanted, this.column)
      this.column = line.length
    }
    else if (this.column !== this.columnWanted) {
      if (line.length <= this.columnWanted)
        this.column = line.length
      else
        this.column = this.columnWanted
    }
  }

  moveDown(rowCount = 1) {
    this.row += rowCount
    const maxRow = this.buffer.getLines().length - 1
    if (this.row > maxRow)
      this.row = maxRow
    const line = this.buffer.lineForRow(this.row)
    if (this.column > line.length) {
      this.columnWanted = Math.max(this.columnWanted, this.column)
      this.column = line.length
    }
    else if (this.column !== this.columnWanted) {
      if (line.length <= this.columnWanted)
        this.column = line.length
      else
        this.column = this.columnWanted
    }
  }

  moveLeft(columnCount = 1) {
    this.column -= columnCount
    if (this.column < 0)
      this.column = 0
    this.columnWanted = this.column
  }

  moveRight(columnCount = 1) {
    const line = this.buffer.lineForRow(this.row)
    this.column += columnCount
    if (this.column > line.length)
      this.column = line.length
    this.columnWanted = this.column
  }

  moveToTop() {
    this.row = 0
    this.column = 0
    this.columnWanted = 0
  }

  moveToBottom() {
    this.row = this.buffer.getLastRow()
    this.column = 0
    this.columnWanted = 0
  }
}

module.exports = Cursor
