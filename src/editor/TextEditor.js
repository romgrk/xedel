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

const SPACE_CHARACTER = ' ';

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
    const model = new TextEditorModel({
      buffer,
      softWrapped: true,
      showLineNumbers: true,
    })
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

    /*
     * Class members
     */

    this.lineNumbersToRender = {
      maxDigits: 2,
      bufferRows: [],
      screenRows: [],
      keys: [],
      softWrappedFlags: [],
      foldableFlags: []
    };
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

  updateDimensions() {

    const rows = this.model.getScreenLineCount() || 1
    const cols = this.model.getLongestScreenRow()
    const isWrapped = this.model.isSoftWrapped()

    // Parse font details
    this.fontSize = DEFAULT_FONT_SIZE
    this.font = Font.parse(`Hasklug Nerd Font ${this.fontSize}px`)

    this.verticalPadding = 5
    this.horizontalPadding = 5

    // Calculate and set total dimensions

    const allocatedWidth  = this.getAllocatedWidth()
    const allocatedHeight = this.getAllocatedHeight()

    this.totalWidth  = this.font.cellWidth  * cols + 1 * this.horizontalPadding
    this.totalHeight = this.font.cellHeight * rows + 2 * this.verticalPadding

    this.queryMaxLineNumberDigits();

    this.gutterWidth  = this.font.cellWidth * (this.lineNumbersToRender.maxDigits + 2)
    this.gutterHeight = allocatedHeight

    const visibleTextWidth  = allocatedWidth - this.gutterWidth
    const editorWidthInChars = Math.floor(visibleTextWidth / this.font.cellWidth) - 1

    this.textWidth  = isWrapped ? visibleTextWidth : Math.max(this.totalWidth,  allocatedWidth - this.gutterWidth)
    this.textHeight = Math.max(this.totalHeight, allocatedHeight)

    this.textArea.setSizeRequest(this.textWidth, this.textHeight)
    this.gutterArea.setSizeRequest(this.gutterWidth, this.gutterHeight)

    this.model.update({
      width: visibleTextWidth,
      editorWidthInChars,
    })

    this.queryLineNumbersToRender()


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

  getRenderedStartRow() {
    return 0
  }

  getRenderedEndRow() {
    return this.model.getScreenLineCount()
  }

  getRenderedRowCount() {
    return Math.max(0, this.getRenderedEndRow() - this.getRenderedStartRow())
  }

  queryLineNumbersToRender() {
    const { model } = this;
    if (!model.anyLineNumberGutterVisible()) return;
    if (this.showLineNumbers !== model.doesShowLineNumbers()) {
      this.remeasureGutterDimensions = true;
      this.showLineNumbers = model.doesShowLineNumbers();
    }

    // this.queryMaxLineNumberDigits();

    const startRow = this.getRenderedStartRow();
    const endRow = this.getRenderedEndRow();
    const renderedRowCount = this.getRenderedRowCount();

    const bufferRows = model.bufferRowsForScreenRows(startRow, endRow);
    const screenRows = new Array(renderedRowCount);
    const keys = new Array(renderedRowCount);
    const foldableFlags = new Array(renderedRowCount);
    const softWrappedFlags = new Array(renderedRowCount);

    let previousBufferRow =
      startRow > 0 ? model.bufferRowForScreenRow(startRow - 1) : -1;
    let softWrapCount = 0;
    for (let row = startRow; row < endRow; row++) {
      const i = row - startRow;
      const bufferRow = bufferRows[i];
      if (bufferRow === previousBufferRow) {
        softWrapCount++;
        softWrappedFlags[i] = true;
        keys[i] = bufferRow + '-' + softWrapCount;
      } else {
        softWrapCount = 0;
        softWrappedFlags[i] = false;
        keys[i] = bufferRow;
      }

      const nextBufferRow = bufferRows[i + 1];
      if (bufferRow !== nextBufferRow) {
        foldableFlags[i] = model.isFoldableAtBufferRow(bufferRow);
      } else {
        foldableFlags[i] = false;
      }

      screenRows[i] = row;
      previousBufferRow = bufferRow;
    }

    // Delete extra buffer row at the end because it's not currently on screen.
    bufferRows.pop();

    this.lineNumbersToRender.bufferRows = bufferRows;
    this.lineNumbersToRender.screenRows = screenRows;
    this.lineNumbersToRender.keys = keys;
    this.lineNumbersToRender.foldableFlags = foldableFlags;
    this.lineNumbersToRender.softWrappedFlags = softWrappedFlags;
  }

  queryMaxLineNumberDigits() {
    const { model } = this;
    if (model.anyLineNumberGutterVisible()) {
      const maxDigits = Math.max(2, model.getLineCount().toString().length);
      if (maxDigits !== this.lineNumbersToRender.maxDigits) {
        this.remeasureGutterDimensions = true;
        this.lineNumbersToRender.maxDigits = maxDigits;
      }
    }
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
    const rowCount = this.model.getScreenLineCount() || 1
    const cx = this.gutterContext

    const {
      maxDigits,
      softWrappedFlags,
      foldableFlags,
      bufferRows,
      screenRows,
    } = this.lineNumbersToRender

    const startRow = 0
    const endRow = rowCount

    for (let row = startRow; row < endRow; row++) {
      const j = row - startRow;
      // const key = keys[j];
      const softWrapped = softWrappedFlags[j];
      const foldable = foldableFlags[j];
      const bufferRow = bufferRows[j];
      const screenRow = screenRows[j];

      /*
       * const decorationsForRow = decorations[j];
       * if (decorationsForRow)
       *   className = className + ' ' + decorationsForRow;
       */

      let number = null;
      {
        number = softWrapped ? SPACE_CHARACTER : String(bufferRow + 1);
        number = SPACE_CHARACTER.repeat(maxDigits - number.length + 1) + number
        number = number + (foldable ? '>' : SPACE_CHARACTER)
      }

      // We need to adjust the line number position to account for block
      // decorations preceding the current row and following the preceding
      // row. Note that we ignore the latter when the line number starts at
      // the beginning of the tile, because the tile will already be
      // positioned to take into account block decorations added after the
      // last row of the previous tile.
      /*
       * let marginTop = rootComponent.heightForBlockDecorationsBeforeRow(row);
       * if (indexInTile > 0)
       *   marginTop += rootComponent.heightForBlockDecorationsAfterRow(
       *     row - 1
       *   );
       */

      const x = 0
      const y = screenRow * this.font.cellHeight

      const markup = `<span foreground="${theme.lineNumber}">${number}</span>`

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
