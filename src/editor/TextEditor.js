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

const TextEditorModel = require('./TextEditorModel')
const TextBuffer = require('./buffer')

const CURSOR_BLINK_RESUME = 300;
const CURSOR_BLINK_PERIOD = 800;

const DEFAULT_FONT_SIZE = 16

const theme = {
  lineNumber:       '#888888',
  backgroundColor:  '#1e1e1e',
  cursorColor:      '#599eff',
  cursorColorFocus: 'rgba(89, 158, 255, 0.6)',
  cursorLineColor:  'rgba(255, 255, 255, 0.1)',
}

class TextEditor extends Gtk.HBox {

  /**
   * @type {TextEditorModel}
   */
  model = null

  blinkValue = true

  /**
   * @param {object} [options]
   * @param {string} options.text
   * @param {string} options.filepath
   * @param {string} options.buffer
   */
  static create({ text = '', filepath, buffer: existingBuffer } = {}) {
    let buffer = existingBuffer
    if (!buffer) {
      buffer = new TextBuffer({ text })
      if (filepath)
        buffer.setPath(filepath)
    }
    const model = new TextEditorModel({ buffer, softWrapped: true })
    return model.getElement()
  }

  /**
   * @param {Object} params
   * @param {TextEditorModel} params.model
   */
  constructor(params) {
    super()

    this.model = params.model

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

  get buffer() {
    return this.model.getBuffer()
  }

  setBuffer(buffer) {
    this.model.setBuffer(buffer)
  }

  getBuffer() {
    return this.model.getBuffer()
  }

  setModel(model) {
    this.model = model
  }

  getModel() {
    return this.model
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

  getLastVisibleScreenRow() {
    const visibleHeight = this.getAllocatedHeight()
    const offsetHeight = this.textWindow.getVadjustment().getValue()
    return Math.floor((visibleHeight + offsetHeight) / this.font.cellHeight) - 1
  }

  getFirstVisibleScreenRow() {
    const offsetHeight = this.textWindow.getVadjustment().getValue()
    return Math.ceil(offsetHeight / this.font.cellHeight)
  }

  scrollMainCursorIntoView() {
    this.scrollRowIntoView(this.model.getLastCursor().getScreenPosition().row)
  }

  scrollRowIntoView(row) {
    const firstVisibleRow = this.getFirstVisibleScreenRow()
    const lastVisibleRow = this.getLastVisibleScreenRow()

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

    const allocatedWidth  = this.getAllocatedWidth()
    const allocatedHeight = this.getAllocatedHeight()

    this.totalWidth  = this.font.cellWidth  * cols  + 1 * this.horizontalPadding
    this.totalHeight = this.font.cellHeight * lines + 2 * this.verticalPadding

    this.gutterWidth  = this.font.cellWidth * 5
    this.gutterHeight = allocatedHeight

    this.textWidth  = Math.max(this.totalWidth,  allocatedWidth - this.gutterWidth)
    this.textHeight = Math.max(this.totalHeight, allocatedHeight)

    this.textWidthInChars = Math.floor(this.textWidth / this.font.cellWidth)

    this.textArea.setSizeRequest(this.textWidth, this.textHeight)
    this.gutterArea.setSizeRequest(this.gutterWidth, this.gutterHeight)

    this.model.update({
      width: this.textWidth,
      editorWidthInChars: this.textWidthInChars,
    })

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
    this.blinkInterval = setInterval(this.blinkTick, CURSOR_BLINK_PERIOD)
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

    /* Surface not ready yet */
    if (this.gutterSurface === undefined)
      return

    /* Draw tokens */
    cx.translate(0, this.verticalPadding - this.getVerticalOffset())
    this.gutterSurface.flush()
    cx.save()
    cx.rectangle(0, 0, this.gutterWidth, this.totalHeight)
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
    cx.setColor(theme.backgroundColor)
    cx.rectangle(0, 0, this.textWidth, this.textHeight)
    cx.fill()

    /* Surface not ready yet */
    if (this.textSurface === undefined)
      return

    /* Skip horizontal & vertical padding */
    cx.translate(this.horizontalPadding, this.verticalPadding)

    /* Draw cursor */
    this.drawCursorLine(cx)
    this.drawCursors(cx)

    /* Draw tokens */
    this.textSurface.flush()
    cx.save()
    cx.rectangle(0, 0, this.textWidth, this.textHeight)
    cx.clip()
    cx.setSourceSurface(this.textSurface, 0, 0)
    cx.paint()
    cx.restore()

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

    console.log({ lines })
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
    const cx = this.textContext
    const lines = this.model.displayLayer.getScreenLines()

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]

      const row = index
      const colum = 0

      const x = colum * this.font.cellWidth
      const y = row   * this.font.cellHeight

      const markup = `<span foreground="#ffffff">${escapeMarkup(line.lineText)}</span>`

      cx.moveTo(x, y)
      this.textLayout.setMarkup(markup)
      PangoCairo.updateLayout(cx, this.textLayout)
      PangoCairo.showLayout(cx, this.textLayout)
    }

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
    const cursors = this.model.getCursors()

    for (let i = 0; i < cursors.length; i++) {
      const cursor = cursors[i]
      const position = cursor.getScreenPosition()

      cx.rectangle(
        position.column * this.font.cellWidth  + 0.5,
        position.row    * this.font.cellHeight + 0.5,
        this.font.cellWidth,
        this.font.cellHeight
      )
      if (this.textArea.hasFocus()) {
        if (this.blinkValue || !cursor.isLastCursor()) {
          cx.setColor(theme.cursorColorFocus)
          cx.fill()
        }
      }
      else {
        cx.setColor(theme.cursorColor)
        cx.setLineWidth(1)
        cx.stroke()
      }
    }
  }

  drawCursorLine(cx) {
    const cursor = this.model.getLastCursor().getScreenPosition()

    const linePosition = cursor.row * this.font.cellHeight
    const width = this.getAllocatedWidth()

    cx.setColor(theme.cursorLineColor)
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
