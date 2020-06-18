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
const TextBuffer = require('./TextBuffer')


const DEFAULT_FONT_SIZE = 16

const theme = {
  lineNumber:      '#888888',
  backgroundColor: '#1e1e1e',
  cursorColor:     'rgba(255, 255, 255, 0.3)',
  cursorLineColor: 'rgba(255, 255, 255, 0.1)',
}


class TextEditor extends Gtk.DrawingArea {
  buffer = null

  cursors = [{ line: 0, column: 0 }]
  cursorMain = 0

  blinkValue = true

  static create(container, options) {
    const buffer = new TextBuffer(options)
    const editor = new TextEditor(buffer, container)
    return editor
  }

  constructor(buffer, container) {
    super()

    this.vexpand = true
    this.hexpand = true
    this.canFocus = true
    this.addEvents(Gdk.EventMask.ALL_EVENTS_MASK)

    this.pangoContext = this.createPangoContext()

    this.container = container
    this.setBuffer(buffer)

    /*
     * Event handlers
     */

    this.on('realize', this.onRealize)
    this.on('draw', this.onDraw)
    this.on('key-press-event', this.onKeyPressEvent)
    this.on('focus-in-event', this.onFocusIn)
    this.on('focus-out-event', this.onFocusOut)
  }

  setBuffer(buffer) {
    this.buffer = buffer
  }

  getBuffer() {
    return this.buffer
  }

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
    this.redrawText()
  }

  updateDimensions() {
    const bufferLines = this.buffer.getAllText().split('\n')
    const lines = bufferLines.length || 1
    const cols = bufferLines.reduce((max, line) => max > line.length ? max : line.length, 0) || 1

    // Parse font details
    this.fontSize = DEFAULT_FONT_SIZE
    this.font = Font.parse(`Hasklug Nerd Font ${this.fontSize}px`)

    this.gutterOffset = this.font.cellWidth * 5
    this.verticalPadding = 5

    // Calculate and set total dimensions
    this.totalWidth  = this.font.cellWidth  * cols
    this.totalHeight = this.font.cellHeight * lines + 2 * this.verticalPadding
    this.setSizeRequest(this.totalWidth, this.totalHeight)

    // Recreate drawing surface
    /*
     * this.textSurface = this.getWindow().createSimilarSurface(
     *                                     Cairo.Content.COLOR,
     *                                     this.totalWidth,
     *                                     this.totalHeight)
     */
    this.textSurface = new Cairo.ImageSurface(
                                        Cairo.Format.ARGB32,
                                        this.totalWidth,
                                        this.totalHeight)

    this.textContext = new Cairo.Context(this.textSurface)
    this.pangoLayout = PangoCairo.createLayout(this.textContext)
    this.pangoLayout.setAlignment(Pango.Alignment.LEFT)
    this.pangoLayout.setFontDescription(this.font.description)
  }

  stopBlink() {
    this.blinkInterval = clearInterval(this.blinkInterval)
    this.blinkValue = true
  }

  resetBlink() {
    if (this.blinkInterval)
      clearInterval(this.blinkInterval)
    this.blinkInterval = setInterval(this.blink, 500)
    this.blinkInterval.unref()
    this.blinkValue = true
  }

  blink = () => {
    this.blinkValue = !this.blinkValue
    this.queueDraw()
  }

  onDraw = (cx) => {
    const allocatedWidth  = this.getAllocatedWidth()
    const allocatedHeight = this.getAllocatedHeight()

    /* Draw background */
    setContextColorFromHex(cx, theme.backgroundColor)
    cx.rectangle(0, 0, allocatedWidth, allocatedHeight)
    cx.fill()

    /* Surface not ready yet */
    if (this.textSurface === undefined)
      return


    /* Draw tokens */
    cx.translate(0, this.verticalPadding)
    this.textSurface.flush()
    cx.save()
    cx.rectangle(0, 0, this.totalWidth, this.totalHeight)
    cx.clip()
    cx.setSourceSurface(this.textSurface, 0, 0)
    cx.paint()
    cx.restore()

    /* Draw cursor */
    cx.translate(this.gutterOffset, 0)

    this.drawCursors(cx)
    this.drawCursorLine(cx)

    return true
  }

  redrawText() {
    const lines = this.buffer.getAllText().split('\n')
    const cx = this.textContext

    lines.forEach((text, index) => {
      const col = 0
      const line = index

      const x = col  * this.font.cellWidth
      const y = line * this.font.cellHeight

      const lineNumber = `<span foreground="${theme.lineNumber}">${String(index + 1).padStart(4, ' ')} </span>`
      const lineContent = `<span foreground="#ffffff">${escapeMarkup(text)}</span>`

      cx.moveTo(x, y)
      this.pangoLayout.setMarkup(lineNumber + lineContent)
      PangoCairo.updateLayout(cx, this.pangoLayout)
      PangoCairo.showLayout(cx, this.pangoLayout)
    })

    this.queueDraw()
  }

  drawText(line, col, token) {

    // console.log(token)
    this.pangoLayout.setMarkup(`<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)

    const {width} = this.pangoLayout.getPixelExtents()[1]
    const calculatedWidth = this.font.cellWidth * token.text.length


    // Draw text

    if (width <= (calculatedWidth + 1) && width >= (calculatedWidth - 1)) {
      const x = col  * this.font.cellWidth
      const y = line * this.font.cellHeight

      // console.log({ x, y, line, col }, `<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)
      this.textContext.moveTo(x, y)
      PangoCairo.updateLayout(this.textContext, this.pangoLayout)
      PangoCairo.showLayout(this.textContext, this.pangoLayout)
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
        this.pangoLayout.setMarkup(`<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(char)}</span>`)

        this.textContext.moveTo(x, y)
        PangoCairo.updateLayout(this.textContext, this.pangoLayout)
        PangoCairo.showLayout(this.textContext, this.pangoLayout)
      }
    }
  }

  drawCursors(cx) {
    if (!this.blinkValue)
      return

    for (let i = 0; i < this.cursors.length; i++) {
      const cursor = this.cursors[i]
      setContextColorFromHex(cx, theme.cursorColor)
      cx.rectangle(
        cursor.column * this.font.cellWidth,
        cursor.line   * this.font.cellHeight,
        this.font.cellWidth,
        this.font.cellHeight
      )
      cx.fill()
      if (i === this.cursorMain)
        cx.stroke()
    }
  }

  drawCursorLine(cx) {
    const cursor = this.cursors[this.cursorMain]

    const linePosition = cursor.line * this.font.cellHeight
    const width = this.getAllocatedWidth()

    setContextColorFromHex(cx, theme.cursorLineColor)
    cx.setLineWidth(2)
    cx.moveTo(0,     linePosition)
    cx.lineTo(width, linePosition)
    cx.stroke()
    cx.moveTo(0,     linePosition + this.font.cellHeight)
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
