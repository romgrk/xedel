/*
 * Screen.js
 */


const EventEmitter = require('events')
const colornames = require('colornames')
const debounce = require('debounce')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '3.0')
const Gdk = gi.require('Gdk', '3.0')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')

const KeyEvent = require('../helpers/key-event.js')
const Font = require('../helpers/font.js')

const EMPTY_OBJECT = {}

class TextEditorDraw extends Gtk.DrawingArea {
  constructor(store) {
    super()

    this.store = store

    this.resetBlink = this.resetBlink.bind(this)
    this.blink = this.blink.bind(this)
    this.onStoreFlush = this.onStoreFlush.bind(this)
    this.onStoreResize = this.onStoreResize.bind(this)
    this.onKeyPressEvent = this.onKeyPressEvent.bind(this)
    this.onDraw = this.onDraw.bind(this)

    this.totalWidth  = 200
    this.totalHeight = 300

    /*
     * Build UI
     */

    // Draw area
    this.drawingArea = new Gtk.DrawingArea()
    this.drawingArea.canFocus = true
    this.drawingArea.addEvents(Gdk.EventMask.ALL_EVENTS_MASK)

    this.element = this.drawingArea

    this.pangoContext = this.drawingArea.createPangoContext()

    /*
     * Event handlers
     */

    this.drawingArea.on('draw', this.onDraw)
    this.drawingArea.on('key-press-event', this.onKeyPressEvent)

    // Start listening to events
    this.store.on('flush', this.onStoreFlush)
    this.store.on('resize', this.onStoreResize)
    this.store.on('cursor', this.resetBlink)

    // Cursor blink
    this.resetBlink()
  }

  updateDimensions(lines, cols) {
    // Parse font details
    this.font = Font.parse(`${this.store.fontFamily} ${this.store.fontSize}px`)

    // calculate the total pixel width/height of the drawing area
    this.totalWidth  = this.font.cellWidth  * cols
    this.totalHeight = this.font.cellHeight * lines

    const gdkWindow = this.drawingArea.getWindow()
    this.cairoSurface = gdkWindow.createSimilarSurface(
                                        Cairo.Content.COLOR,
                                        this.totalWidth,
                                        this.totalHeight)

    console.log('this.cairoSurface:', this.cairoSurface)
    console.log('this.cairoSurface:', gi.System.addressOf(this.cairoSurface))

    this.cairoContext = new Cairo.Context(this.cairoSurface)
    this.pangoLayout = PangoCairo.createLayout(this.cairoContext)
    this.pangoLayout.setAlignment(Pango.Alignment.LEFT)
    this.pangoLayout.setFontDescription(this.font.description)
    // this.window.resize(this.totalWidth, this.totalHeight)
  }

  resetBlink() {
    if (this.blinkInterval)
      clearInterval(this.blinkInterval)
    this.blinkInterval = setInterval(this.blink, 600)
    this.blinkInterval.unref()
    this.blinkValue = true
  }

  blink() {
    this.blinkValue = !this.blinkValue
    this.drawingArea.queueDraw()
  }

  getPosition(line, col) {
    return [col * this.font.cellWidth, line * this.font.cellHeight]
  }

  getPangoAttributes(attr) {
    /* {
      fg: 'black',
      bg: 'white',
      sp: 'white',
      bold: true,
      italic: undefined,
      underline: undefined,
      undercurl: undefined,
      reverse: undefined,
    } */

    const pangoAttrs = {
      foreground: colorToHex(attr.fg ? attr.fg : this.store.foregroundColor),
      background: colorToHex(attr.bg ? attr.bg : this.store.backgroundColor),
    }

    if (attr) {
      Object.keys(attr).forEach(key => {
        switch (key) {
          case 'reverse':
            const {foreground, background} = pangoAttrs
            pangoAttrs.foreground = background
            pangoAttrs.background = foreground
            break
          case 'italic':
            pangoAttrs.font_style = 'italic'
            break
          case 'bold':
            pangoAttrs.font_weight = 'bold'
            if (this.font.boldSpacing)
              pangoAttrs.letter_spacing = String(this.font.boldSpacing)
            break
          case 'underline':
            pangoAttrs.underline = 'single'
            break
        }
      })
    }

    return Object.keys(pangoAttrs).map(key => `${key}="${pangoAttrs[key]}"`).join(' ')
  }

  drawText(line, col, token, context) {

    // console.log(token)
    this.pangoLayout.setMarkup(`<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)

    const {width} = this.pangoLayout.getPixelExtents()[1]
    const calculatedWidth = this.font.cellWidth * token.text.length


    // Draw text

    if (width <= (calculatedWidth + 1) && width >= (calculatedWidth - 1)) {
      const x = col  * this.font.cellWidth
      const y = line * this.font.cellHeight

      // console.log({ x, y, line, col }, `<span ${this.getPangoAttributes(token.attr || {})}>${escapeMarkup(token.text)}</span>`)
      context.moveTo(x, y)
      PangoCairo.updateLayout(context, this.pangoLayout)
      PangoCairo.showLayout(context, this.pangoLayout)
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

        context.moveTo(x, y)
        PangoCairo.updateLayout(context, this.pangoLayout)
        PangoCairo.showLayout(context, this.pangoLayout)
      }
    }
  }

  drawCursor(context) {
    const focused = this.store.focused
    const mode = this.store.mode

    setContextColorFromHex(context, this.store.cursorColor)

    if (!focused) {
      this.drawCursorBlockOutline(context, false)
    }
    else if (mode === 'insert' || mode === 'cmdline_normal') {
      this.drawCursorI(context, true)
    }
    else if (mode === 'normal') {
      this.drawCursorBlock(context, true)
    }
    else if (mode === 'visual') {
      this.drawCursorBlock(context, false)
    }
    else if (mode === 'replace' || mode === 'operator') {
      this.drawCursorUnderline(context, false)
    }
    else {
      this.drawCursorBlock(context, true)
    }
  }

  drawCursorUnderline(context, blink) {
    if (blink && !this.blinkValue)
      return

    const cursor = this.store.cursor

    context.rectangle(
      cursor.col * this.font.cellWidth,
      (cursor.line + 1) * this.font.cellHeight - this.store.cursorThickness,
      this.font.cellWidth,
      this.store.cursorThickness
    )
    context.fill()
  }

  drawCursorI(context, blink) {
    if (blink && !this.blinkValue)
      return

    const cursor = this.store.cursor

    context.rectangle(
      cursor.col * this.font.cellWidth,
      cursor.line * this.font.cellHeight,
      this.store.cursorThickness,
      this.font.cellHeight
    )
    context.fill()
  }

  drawCursorBlock(context, blink) {
    if (blink && !this.blinkValue)
      return

    const screen = this.store.screen
    const cursor = this.store.cursor

    const token = screen.tokenForCharAt(cursor.line, cursor.col) || { text: '' }

    const text = token.text || ' '
    const attr = token.attr || EMPTY_OBJECT

    const fg = colorToHex(attr.fg ? attr.fg : this.store.foregroundColor)
    const bg = colorToHex(attr.bg ? attr.bg : this.store.backgroundColor)

    const cursorToken = { text, attr: { ...attr, fg: bg, bg: fg } }

    this.drawText(cursor.line, cursor.col, cursorToken, context)
  }

  drawCursorBlockOutline(context, blink) {
    if (blink && !this.blinkValue)
      return

    const cursor = this.store.cursor

    context.rectangle(
      cursor.col * this.font.cellWidth,
      cursor.line * this.font.cellHeight,
      this.font.cellWidth,
      this.font.cellHeight
    )
    context.stoke()
  }

  onDraw(context) {

    const screen = this.store.screen
    const mode = this.store.mode

    const {fontFamily, fontSize, lineHeight} = this.store

    const allocatedWidth  = this.drawingArea.getAllocatedWidth()
    const allocatedHeight = this.drawingArea.getAllocatedHeight()

    context.setFontSize(fontSize)

    /* Draw background */
    setContextColorFromHex(context, colorToHex(this.store.backgroundColor))
    context.rectangle(0, 0, allocatedWidth, allocatedHeight)
    context.fill()

    /* Surface not ready yet */
    if (this.cairoSurface === undefined)
      return

    /* Draw tokens */
    this.cairoSurface.flush()
    context.save()
    context.rectangle(0, 0, this.totalWidth, this.totalHeight)
    context.clip()
    context.setSourceSurface(this.cairoSurface, 0, 0)
    context.paint()
    context.restore()

    /* Draw cursor */
    if (screen.size.lines > 0)
      this.drawCursor(context)

    /* Draw grid */
    if (false) {
      let currentY = 0

      context.setSourceRgba(1.0, 0, 0, 0.8)
      context.setLineWidth(1)

      for (let i = 0; i < screen.lines.length; i++) {

        context.moveTo(0, currentY)
        context.lineTo(this.totalWidth, currentY)
        context.stroke()

        let currentX = 0

        for (let j = 0; j < screen.size.cols; j++) {
          context.moveTo(currentX, currentY)
          context.lineTo(currentX, currentY + this.font.cellHeight)
          context.stroke()

          currentX += this.font.cellWidth
        }

        currentY += this.font.cellHeight
      }
    }

    return true
  }

  onStoreFlush() {
    this.drawingArea.queueDraw()

    const screen = this.store.screen

    /* Draw tokens */
    for (let i = 0; i < screen.lines.length; i++) {
      const line = screen.lines[i]
      const tokens = line.tokens

      let col = 0
      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j]
        this.drawText(i, col, token, this.cairoContext)
        col += token.text.length
      }
    }
  }

  onStoreResize(lines, cols) {
    this.updateDimensions(lines, cols)
  }

  onKeyPressEvent(event) {
    if (!event)
      return

    this.emit('key-press', KeyEvent.fromGdk(event), event)
    this.resetBlink()

    return true
  }
}

module.exports = TextEditorDraw;



/*
 * Helpers
 */

function colorToHex(color) {
  if (color.charAt(0) === '#')
    return color
  return colornames(color)
}

function gdkColorToHex(color) {
  return (
    '#'
    + (color.red   * 255).toFixed(0).toString(16)
    + (color.green * 255).toFixed(0).toString(16)
    + (color.blue  * 255).toFixed(0).toString(16)
  )
}

function setContextColorFromHex(context, hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  context.setSourceRgb(r, g, b)
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

