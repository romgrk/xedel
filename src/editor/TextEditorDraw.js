/*
 * TextEditorDraw.js
 */

const path = require('path')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')

const workspace = require('../workspace')
const Font = require('../utils/font')
const Cursor = require('./Cursor')
const TextBuffer = require('./TextBuffer')


const DEFAULT_FONT_SIZE = 16

const theme = {
  lineNumber:       '#888888',
  backgroundColor:  '#1e1e1e',
  cursorColor:      '#599eff',
  cursorColorFocus: 'rgba(89, 158, 255, 0.6)',
  cursorLineColor:  'rgba(255, 255, 255, 0.1)',
}

class TextEditor extends Gtk.HBox {
  buffer = null

  cursors = [new Cursor(0, 0, this)]
  cursorMainIndex = 0
  get cursorMain() { return this.cursors[this.cursorMainIndex] }

  blinkValue = true

  static create(options) {
    const buffer = new TextBuffer(options)
    const editor = new TextEditor(buffer)
    return editor
  }

  constructor(buffer) {
    super()

    this.vexpand = true
    this.hexpand = true

    this.gutterArea = new Gtk.DrawingArea()

    this.textArea = new Gtk.DrawingArea()
    this.textArea.canFocus = true
    this.textArea.addEvents(Gdk.EventMask.ALL_EVENTS_MASK)

    this.textWindow = new Gtk.ScrolledWindow()
    this.textWindow.add(this.textArea)

    this.packStart(this.gutterArea, false, false, 0)
    this.packStart(this.textWindow, true,  true,  0)

    this.pangoContext = this.createPangoContext()

    this.setBuffer(buffer)

    /*
     * Event handlers
     */

    this.textArea.on('realize', this.onRealize)
    this.textArea.on('key-press-event', this.onKeyPressEvent)
    this.textArea.on('focus-in-event', this.onFocusIn)
    this.textArea.on('focus-out-event', this.onFocusOut)
    this.textArea.on('draw', this.onDrawText)

    this.gutterArea.on('draw', this.onDrawGutter)
  }

  setBuffer(buffer) {
    this.buffer = buffer
  }

  getBuffer() {
    return this.buffer
  }

  queueDraw() {
    this.textArea.queueDraw()
  }

  /*
   * Event handlers
   */

  onFocusIn = () => {
    this.resetBlink()
  }

  onFocusOut = () => {
    this.stopBlink()
  }

  onKeyPressEvent = (event) => {
    if (!event)
      return
    console.log('editor', event)
    this.resetBlink()
    return true
  }

  onRealize = () => {
    this.updateDimensions()
    this.redraw()
  }

  /*
   * Position
   */

  getLastVisibleBufferRow() {
    const visibleHeight = this.getAllocatedHeight()
    const offsetHeight = this.textWindow.getVadjustment().getValue()
    return Math.floor((visibleHeight + offsetHeight) / this.font.cellHeight) - 1
  }

  getFirstVisibleBufferRow() {
    const offsetHeight = this.textWindow.getVadjustment().getValue()
    return Math.ceil(offsetHeight / this.font.cellHeight)
  }

  scrollMainCursorIntoView() {
    this.scrollRowIntoView(this.cursorMain.getScreenPosition().row)
  }

  scrollRowIntoView(row) {
    const firstVisibleRow = this.getFirstVisibleBufferRow()
    const lastVisibleRow = this.getLastVisibleBufferRow()

    if (row < firstVisibleRow) {
      this.textWindow.getVadjustment().setValue(row * this.font.cellHeight)
    }
    else if (row > lastVisibleRow) {
      const visibleHeight = this.getAllocatedHeight()
      const visibleRows = Math.floor(visibleHeight / this.font.cellHeight)
      this.textWindow.getVadjustment().setValue((row + 1) * this.font.cellHeight - visibleRows * this.font.cellHeight)
    }
  }

  /*
   * Cursor
   */

  hasMultipleCursors() {
    return this.cursors.length > 1
  }

  moveDown(lineCount) {
    this.cursors.forEach(c => c.moveDown(lineCount))
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  moveUp(lineCount) {
    this.cursors.forEach(c => c.moveUp(lineCount))
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  moveLeft(columnCount) {
    this.cursors.forEach(c => c.moveLeft(columnCount))
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  moveRight(columnCount) {
    this.cursors.forEach(c => c.moveRight(columnCount))
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  moveToTop() {
    this.cursors.forEach(c => c.moveToTop())
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  moveToBottom() {
    this.cursors.forEach(c => c.moveToBottom())
    this.scrollMainCursorIntoView()
    this.queueDraw()
  }

  /*
   * Rendering
   */

  getVerticalOffset() {
    return this.textWindow.getVadjustment().getValue()
  }

  setVerticalOffset(offset) {
    this.textWindow.getVadjustment().setValue(offset)
  }

  getHorizontalOffset() {
    return this.textWindow.getHadjustment().getValue()
  }

  setHorizontalOffset(offset) {
    this.textWindow.getHadjustment().setValue(offset)
  }

  updateDimensions() {
    const bufferLines = this.buffer.getLines()
    const lines = bufferLines.length || 1
    const cols = bufferLines.reduce((max, line) => max > line.length ? max : line.length, 0) || 1

    // Parse font details
    this.fontSize = DEFAULT_FONT_SIZE
    this.font = Font.parse(`Hasklug Nerd Font ${this.fontSize}px`)

    this.verticalPadding = 5
    this.horizontalPadding = 5

    // Calculate and set total dimensions
    this.totalWidth  = this.font.cellWidth  * cols  + 1 * this.horizontalPadding
    this.totalHeight = this.font.cellHeight * lines + 2 * this.verticalPadding
    this.textWidth  = Math.max(this.totalWidth, this.getAllocatedWidth())
    this.textHeight = Math.max(this.totalHeight, this.getAllocatedHeight())
    this.textArea.setSizeRequest(this.textWidth, this.textHeight)

    this.gutterWidth = this.font.cellWidth * 5
    this.gutterArea.setSizeRequest(this.gutterWidth, this.getAllocatedHeight())

    /* Recreate drawing surfaces */
    this.textSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, this.totalWidth, this.totalHeight)
    this.textContext = new Cairo.Context(this.textSurface)
    this.textLayout = PangoCairo.createLayout(this.textContext)
    this.textLayout.setAlignment(Pango.Alignment.LEFT)
    this.textLayout.setFontDescription(this.font.description)

    this.gutterSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, this.gutterWidth, this.totalHeight)
    this.gutterContext = new Cairo.Context(this.gutterSurface)
    this.gutterLayout = PangoCairo.createLayout(this.gutterContext)
    this.gutterLayout.setAlignment(Pango.Alignment.LEFT)
    this.gutterLayout.setFontDescription(this.font.description)
  }

  stopBlink() {
    this.blinkInterval = clearInterval(this.blinkInterval)
    this.blinkValue = true
  }

  resetBlink() {
    if (this.blinkInterval)
      clearInterval(this.blinkInterval)
    this.blinkInterval = setInterval(this.blinkTick, 500)
    this.blinkInterval.unref()
    this.blinkValue = true
    this.queueDraw()
  }

  blinkTick = () => {
    this.blinkValue = !this.blinkValue
    this.queueDraw()
  }

  onDrawGutter = (cx) => {
    console.time('onDrawGutter')

    /* Draw background */
    // setContextColorFromHex(cx, theme.backgroundColor)
    // cx.rectangle(0, 0, this.totalWidth, this.totalHeight)
    // cx.fill()

    /* Surface not ready yet */
    if (this.gutterSurface === undefined)
      return

    /* Draw tokens */
    cx.translate(0, this.verticalPadding - this.getVerticalOffset())
    this.gutterSurface.flush()
    cx.save()
    cx.rectangle(0, 0, this.totalWidth, this.totalHeight)
    cx.clip()
    cx.setSourceSurface(this.gutterSurface, 0, 0)
    cx.paint()
    cx.restore()

    console.timeEnd('onDrawGutter')
    return true
  }

  onDrawText = (cx) => {
    console.time('onDrawText')

    /* Draw background */
    setContextColorFromHex(cx, theme.backgroundColor)
    cx.rectangle(0, 0, this.textWidth, this.textHeight)
    cx.fill()

    /* Surface not ready yet */
    if (this.textSurface === undefined)
      return

    /* Skip horizontal & vertical padding */
    cx.translate(this.horizontalPadding, this.verticalPadding)

    /* Draw tokens */
    this.textSurface.flush()
    cx.save()
    cx.rectangle(0, 0, this.textWidth, this.textHeight)
    cx.clip()
    cx.setSourceSurface(this.textSurface, 0, 0)
    cx.paint()
    cx.restore()

    /* Draw cursor */
    this.drawCursorLine(cx)
    this.drawCursors(cx)

    console.timeEnd('onDrawText')
    return true
  }

  redraw() {
    this.redrawGutter()
    this.redrawText()
  }

  redrawGutter() {
    const lines = this.buffer.getLineCount() || 1
    const cx = this.gutterContext

    for (let row = 0; row < lines; row++) {
      const x = 0
      const y = row * this.font.cellHeight

      const markup = `<span foreground="${theme.lineNumber}">${String(row + 1).padStart(4, ' ')} </span>`

      cx.moveTo(x, y)
      this.gutterLayout.setMarkup(markup)
      PangoCairo.updateLayout(cx, this.gutterLayout)
      PangoCairo.showLayout(cx, this.gutterLayout)
    }

    this.queueDraw()
  }

  redrawText() {
    const lines = this.buffer.getLines()
    const cx = this.textContext

    lines.forEach((text, index) => {
      const col = 0
      const line = index

      const x = col  * this.font.cellWidth
      const y = line * this.font.cellHeight

      const markup = `<span foreground="#ffffff">${escapeMarkup(text)}</span>`

      cx.moveTo(x, y)
      this.textLayout.setMarkup(markup)
      PangoCairo.updateLayout(cx, this.textLayout)
      PangoCairo.showLayout(cx, this.textLayout)
    })

    this.queueDraw()
  }

  drawText(line, col, token) {

    // console.log(token)
    this.textLayout.setMarkup(`<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)

    const {width} = this.textLayout.getPixelExtents()[1]
    const calculatedWidth = this.font.cellWidth * token.text.length


    // Draw text

    if (width <= (calculatedWidth + 1) && width >= (calculatedWidth - 1)) {
      const x = col  * this.font.cellWidth
      const y = line * this.font.cellHeight

      // console.log({ x, y, line, col }, `<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)
      this.textContext.moveTo(x, y)
      PangoCairo.updateLayout(this.textContext, this.textLayout)
      PangoCairo.showLayout(this.textContext, this.textLayout)
    }
    else {
      // Draw characters one by one

      /* console.log({
       *   calculatedWidth: this.font.cellWidth * token.text.length,
       *   width: width,
       *   text: token.text,
       * }) */
      for (let i = 0; i < token.text.length; i++) {
        const char = token.text[i]

        // Draw text
        const x = (col + i)  * this.font.cellWidth
        const y = line * this.font.cellHeight

        // console.log({ x, y, line, col, cellWidth: this.font.cellWidth }, `<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(char)}</span>`)
        this.textLayout.setMarkup(`<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(char)}</span>`)

        this.textContext.moveTo(x, y)
        PangoCairo.updateLayout(this.textContext, this.textLayout)
        PangoCairo.showLayout(this.textContext, this.textLayout)
      }
    }
  }

  drawCursors(cx) {
    for (let i = 0; i < this.cursors.length; i++) {
      const cursor = this.cursors[i]
      cx.rectangle(
        cursor.column * this.font.cellWidth,
        cursor.row    * this.font.cellHeight,
        this.font.cellWidth,
        this.font.cellHeight
      )
      if (this.textArea.hasFocus()) {
        if (this.blinkValue || this.cursorMainIndex !== i) {
          setContextColorFromHex(cx, theme.cursorColorFocus)
          cx.fill()
        }
      }
      else {
        setContextColorFromHex(cx, theme.cursorColor)
        cx.setLineWidth(1)
        cx.stroke()
      }
    }
  }

  drawCursorLine(cx) {
    const cursor = this.cursors[this.cursorMainIndex]

    const linePosition = cursor.row * this.font.cellHeight
    const width = this.getAllocatedWidth()

    setContextColorFromHex(cx, theme.cursorLineColor)
    cx.setLineWidth(2)
    cx.moveTo(-this.horizontalPadding, linePosition)
    cx.lineTo(width, linePosition)
    cx.stroke()
    cx.moveTo(-this.horizontalPadding, linePosition + this.font.cellHeight)
    cx.lineTo(width, linePosition + this.font.cellHeight)
    cx.stroke()
  }
}

module.exports = TextEditor

function setContextColorFromHex(cx, color) {
  /* const r = parseInt(hex.slice(1, 3), 16) / 255
   * const g = parseInt(hex.slice(3, 5), 16) / 255
   * const b = parseInt(hex.slice(5, 7), 16) / 255 */
  const c = new Gdk.RGBA()
  const success = c.parse(color)
  if (!success)
    throw new Error(`GdkRGBA.parse: invalid color: ${color}`)
  cx.setSourceRgba(c.red, c.green, c.blue, c.alpha)
}

function escapeMarkup(text) {
  return text.replace(/<|>|&/g, m => {
    switch (m) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
    }
    return m
  })
}
