/*
 * TextEditorDraw.js
 */

const fs = require('fs')
const path = require('path')
const isEqual = require('lodash.isequal')
const CSON = require('season')
const LineTopIndex = require('line-top-index');
const { CompositeDisposable, Disposable, Emitter } = require('event-kit');
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Gdk = gi.require('Gdk', '4.0')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')
const Graphene = gi.require('Graphene', '1.0')

const Font = require('../utils/font')
const Color = require('../utils/color')
const Key = require('../key')
const Text = require('./text-utils')

const { isPairedCharacter } = require('./text-utils');
const TextEditor = require('./text-editor')
const TextBuffer = require('./text-buffer')
const { Point, Range } = TextBuffer

const TreeSitterLanguageMode = require('./tree-sitter-language-mode')
const doomOne = require('./theme-doom-one')

const DEFAULT_ROWS_PER_TILE = 6;

const SPACE_CHARACTER = ' ';
const ZERO_WIDTH_NBSP_CHARACTER = '\ufeff';

const MOUSE_DRAG_AUTOSCROLL_MARGIN = 40;
const CURSOR_BLINK_RESUME_DELAY = 300;
const CURSOR_BLINK_PERIOD = 1400;

// const DEFAULT_FONT_FAMILY = 'SauceCodePro Nerd Font'
// const DEFAULT_FONT_FAMILY = 'DejaVu Sans Mono for Powerline'
const DEFAULT_FONT_FAMILY = 'JetBrainsMono Nerd Font'
const DEFAULT_FONT_SIZE = 12

// Colors, for debugging
// const RED  = Gdk.RGBA.create('#ff0000')
// const BLUE = Gdk.RGBA.create('#8888ff')

const theme = Color.parseObject({
  lineNumber:          '#888888',
  backgroundColor:     '#1e1e1e',
  cursorColor:         '#f0f0f0',
  cursorColorInactive: 'rgba(255, 255, 255, 0.6)',
  cursorLineColor:     'rgba(255, 255, 255, 0.1)',
})

/*
 * Tasks:
 * [ ] decorations
 *     [x] lines
 *     [x] highlights
 *     [x] lineNumbers
 *     [x] cursors
 *     [ ] overlays
 *     [ ] customGutter
 *     [x] blocks
 *     [~] text (finish indent guides)
 */

const decorationStyleByClass = Color.parseObject({
  'cursor-line': {
    background: 'rgba(255, 255, 255, 0.10)',
  },
  'cursor-line-number': {
    foreground: '#599eff',
  },
  'diff-added-line': {
    background: 'rgba(100, 255, 130, 0.2)',
  },
  'diff-added-line-number': {
    foreground: '#4EC849',
    fontWeight: 'bold',
  },

  'selection': {
    background: 'rgba(255, 255, 255, 0.15)',
  },
  'highlight': {
    background: 'rgba(255, 255, 255, 0.15)',
  },
  'vim-mode-plus-find-char': {
    background: 'rgba(255, 255, 255, 0.2)',
  },

  'invisible-character': {
    foreground: '#888888',
  },

  ...doomOne,
})

const CursorType = {
  BEAM: 0,
  BLOCK: 1,
  UNDER: 2,
}

const defaultProps = {
  mini: false,
  readOnly: false,
  cursorType: CursorType.BLOCK,
  cursorBlink: false,
}

class TextEditorComponent extends Gtk.Widget {
  static name = 'TextEditor'
  static CursorType = CursorType

  theme = theme

  /**
   * @type {TextEditor}
   */
  model = null

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
    const model = new TextEditor({
      buffer,
      softWrapped: true,
      showLineNumbers: true,
      showIndentGuide: true,
      invisibles: {
        tab: '',
        cr: false,
        eol: '$',
        space: '·'
      }
    })
    model.setVerticalScrollMargin(0)
    model.setHorizontalScrollMargin(2)

    // const lineDecorationOptions = { type: 'line', class: 'diff-added-line' }
    // model.decorateMarker(model.markBufferRange([[6, 0], [6, "const path = require('path')".length]]), lineDecorationOptions)
    // model.decorateMarker(model.markBufferRange([[7, 0], [7, "const isEqual = require('lodash.isequal')".length]]), lineDecorationOptions)

    // const gutterDecorationOptions = { type: 'gutter', class: 'diff-added-line-number' }
    // model.decorateMarker(model.markBufferRange([[6, 0], [6, 1]]), gutterDecorationOptions)
    // model.decorateMarker(model.markBufferRange([[7, 0], [7, 1]]), gutterDecorationOptions)

    model.scanInBufferRange(/require/g, [[0, 0], [22, 0]], ({ range }) => {
      model.decorateMarker(
        model.markBufferRange(range),
        { type: 'highlight', class: 'highlight' }
      )
    })

    const image = Gtk.Image.newFromFile(path.join(__dirname, '../../static/demo.gif'))
    image.setSizeRequest(200, 200)
    model.decorateMarker(
      model.markScreenPosition([0, 0]),
      { type: 'block', position: 'after', item: image })

    // const label = new Gtk.Label({ label: 'This is a test' })
    // label.addCssClass('dim-label title')
    // model.decorateMarker(
    //   model.markScreenPosition([6, 0]),
    //   { type: 'block', position: 'before', item: label })

    // model.decorateMarker(
    //   model.markScreenPosition([9, 0]),
    //   { type: 'block', position: 'before', item: Gtk.Button.newFromIconName('starred') })

    const languageMode = new TreeSitterLanguageMode({
      buffer,
      grammar: xedel.grammars.grammarForScopeName('source.js'),
      grammars: xedel.grammars,
      config: xedel.config,
    });
    buffer.setLanguageMode(languageMode);

    return model.getElement()
  }

  /**
   * @param {Object} props
   * @param {TextEditor} props.model
   */
  constructor(props) {
    super()

    // For text-editor.js, that still assumes component != element in some places
    this.component = this

    this.props = {}
    this.update(Object.assign({}, defaultProps, props))

    this.vexpand = true
    this.hexpand = true
    this.focusable = true
    this.focusOnClick = true

    this.backgroundArea = new BackgroundComponent({ element: this })
    this.highlightsArea = new HighlightsComponent({ element: this })
    this.cursorArea     = new CursorsComponent({ element: this })

    this.lineNumberGutterArea =
      new LineNumberGutterComponent({
        rootComponent: this,
        model: this.model,
        name: 'line-number',
        measurements: {},
      })

    this.gutterContainer = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0)
    this.gutterContainer.focusable = false
    this.gutterContainer.append(this.lineNumberGutterArea)

    this.textContainer = new Gtk.Fixed()
    this.textContainer.focusable = false

    this.textWindow = new Gtk.ScrolledWindow()
    this.textWindow.focusable = false
    this.textWindow.hexpand = true
    this.textWindow.vexpand = true
    this.textWindow.setChild(this.textContainer)

    this.textWindowContainer = new Gtk.Fixed()
    this.textWindowContainer.focusable = false
    this.textWindowContainer.put(this.backgroundArea, 0, 0)
    this.textWindowContainer.put(this.highlightsArea, 0, 0)
    this.textWindowContainer.put(this.textWindow,     0, 0)
    this.textWindowContainer.put(this.cursorArea,     0, 0)

    this.box = new Gtk.Box(Gtk.Orientation.HORIZONTAL, 0)
    this.box.focusable = false
    if (!this.props.mini)
      this.box.append(this.gutterContainer)
    this.box.append(this.textWindowContainer)
    this.box.insertBefore(this)


    /*
     * Event handlers
     */

    this.didBlur = this.didBlur.bind(this);
    this.didFocus = this.didFocus.bind(this);
    this.didTextInput = this.didTextInput.bind(this);
    this.didKeydown = this.didKeydown.bind(this);
    this.didKeyup = this.didKeyup.bind(this);
    this.didKeypress = this.didKeypress.bind(this);
    this.didCompositionStart = this.didCompositionStart.bind(this);
    this.didCompositionUpdate = this.didCompositionUpdate.bind(this);
    this.didCompositionEnd = this.didCompositionEnd.bind(this);

    this.didChange = this.didChange.bind(this);
    this.didChangeCursorPosition = this.didChangeCursorPosition.bind(this);
    this.didScroll = this.didScroll.bind(this);
    this.didMouseDownOnContent = this.didMouseDownOnContent.bind(this);
    this.debouncedResumeCursorBlinking = debounce(
      this.resumeCursorBlinking.bind(this),
      CURSOR_BLINK_RESUME_DELAY
    );

    this.didResize = this.didResize.bind(this);
    this.didSizeAllocate = this.didSizeAllocate.bind(this);

    this.keyController = new Gtk.EventControllerKey()
    this.keyController.on('key-pressed', this.onKeyPressEvent)
    this.addController(this.keyController)

    this.focusController = new Gtk.EventControllerFocus()
    this.focusController.on('enter', this.didFocus)
    this.focusController.on('leave', this.didBlur)
    this.addController(this.focusController)

    // TODO: implement these
    // this.textContainer.on('button-press-event', this.didMouseDownOnContent)

    this.textWindow.getVadjustment().on('value-changed', this.didScroll)
    this.textWindow.getHadjustment().on('value-changed', this.didScroll)


    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.disposables.add(
      this.model.onDidChangeCursorPosition(this.didChangeCursorPosition))
    this.disposables.add(
      this.model.onDidChange(this.didChange))

    /*
     * Class members
     */

    this.lineTopIndex = new LineTopIndex();
    this.updateScheduled = false;
    this.suppressUpdates = false;
    this.hasInitialMeasurements = false;
    this.measurements = {
      lineHeight: 0,
      baseCharacterWidth: 0,
      doubleWidthCharacterWidth: 0,
      halfWidthCharacterWidth: 0,
      koreanCharacterWidth: 0,
      gutterContainerWidth: 0,
      gutterSurfaceHeight: 0,
      lineNumberGutterWidth: 0,
      clientContainerHeight: 0,
      clientContainerWidth: 0,
      textContainerWidth: 0,
      textContainerHeight: 0,
      verticalScrollbarWidth: 0,
      horizontalScrollbarHeight: 0,
      horizontalPadding: 10,
      verticalPadding: 0,
      longestLineWidth: 0
    };
    this.derivedDimensionsCache = {};
    this._visible = false;
    this.cursorsBlinking = false;
    this.cursorsBlinkedOff = false;
    this.nextUpdateOnlyBlinksCursors = null;
    this.linesToMeasure = new Map();
    this.extraRenderedScreenLines = new Map();
    this.horizontalPositionsToMeasure = new Map(); // Keys are rows with positions we want to measure, values are arrays of columns to measure
    this.horizontalPixelPositionsByScreenLineId = new Map(); // Values are maps from column to horizontal pixel positions
    this.blockDecorationsToMeasure = new Set();
    this.blockDecorationsByElement = new WeakMap();
    // this.blockDecorationSentinel = document.createElement('div');
    // this.blockDecorationSentinel.style.height = '1px';
    this.heightsByBlockDecoration = new WeakMap();
    this.lineComponentsByScreenLineId = new Map();
    this.overlayComponents = new Set();
    this.shouldRenderDummyScrollbars = true;
    this.remeasureScrollbars = false;
    this.pendingAutoscroll = null;
    this.scrollTopPending = false;
    this.scrollLeftPending = false;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.previousScrollWidth = 0;
    this.previousScrollHeight = 0;
    this.lastKeydown = null;
    this.lastKeydownBeforeKeypress = null;
    this.accentedCharacterMenuIsOpen = false;
    this.remeasureGutterDimensions = false;
    this.guttersToRender = [this.model.getLineNumberGutter()];
    this.guttersVisibility = [this.guttersToRender[0].visible];
    this.idsByTileStartRow = new Map();
    this.tilesById = new Map()
    this.nextTileId = 0;
    this.renderedTileStartRows = [];
    this.showLineNumbers = this.model.doesShowLineNumbers();

    this.lineNumbersToRender = {
      maxDigits: 2,
      bufferRows: [],
      screenRows: [],
      keys: [],
      softWrappedFlags: [],
      foldableFlags: []
    };
    this.decorationsToRender = {
      lineNumbers: new Map(),
      lines: null,
      highlights: [],
      cursors: [],
      overlays: [],
      customGutter: new Map(),
      blocks: new Map(),
      text: []
    };
    this.decorationsToMeasure = {
      highlights: [],
      cursors: new Map()
    };
    this.textDecorationsByMarker = new Map();
    this.textDecorationBoundaries = [];
    this.pendingScrollTopRow = 0;
    this.pendingScrollLeftColumn = 0;

    this.measuredContent = false;
    this.queryGuttersToRender();
    this.queryMaxLineNumberDigits();
    this.observeBlockDecorations();
    // this.updateClassList();
    // etch.updateSync(this);
    // this.render()
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.disposables.dispose();
    this.highlightsArea.destroy();
    this.model.destroy()
  }

  get buffer() {
    return this.model?.getBuffer()
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

  hasFocus() {
    return this.isFocus()
  }

  setMini(mini) {
    this.update({ mini })
  }

  setReadOnly(readOnly) {
    this.update({ readOnly })
  }

  /*
   * Virtual functions
   */

  sizeAllocate(width, height, baseline) {
    /* ignore return value, this is just so that GTK doesn't complain */
    this.box.measure(Gtk.Orientation.HORIZONTAL, width)
    this.box.sizeAllocate(
      new Gdk.Rectangle({ x: 0, y: 0, width, height }),
      baseline
    )

    setImmediate(() => {
      if (this.attached)
        this.didSizeAllocate()
      else
        this.didAttach()
    })
  }

  /*
   * Event handlers
   */

  onKeyPressEvent = (keyval, keycode, state) => {
    // TODO: clean this
    // TODO: use didTextInput()
    console.log(keyval, Gdk.keyvalName(keyval), keycode, state)
    const key = Key.fromArgs(keyval, keycode, state)
    if (!key.ctrl && !key.alt && !key.cmd && !key.super) {
      switch (keyval) {
        // case Gdk.KEY_g: this.model.moveToTop(); break
        // case Gdk.KEY_G: this.model.moveToBottom(); break
        // case Gdk.KEY_j: this.model.moveDown(); break
        // case Gdk.KEY_k: this.model.moveUp(); break
        // case Gdk.KEY_h: this.model.moveLeft(); break
        // case Gdk.KEY_l: this.model.moveRight(); break
        // case Gdk.KEY_BackSpace: this.model.backspace(); break
        case Gdk.KEY_Return: this.model.insertText('\n'); break
        default: {
          const key = Key.fromArgs(keyval, keycode, state)
          if (key.string && Text.isPrintable(key.string.charCodeAt(0))) {
            this.model.insertText(key.string)
          }
        }
      }
    }
    this.pauseCursorBlinking()
    return false
  }

  /*
   * Rendering
   */

  render() {
    this.renderGutter()
    this.renderText()
  }

  renderGutter() {
    if (this.props.mini)
      return
    this.gutterContainer.setSizeRequest(
      this.measurements.gutterContainerWidth,
      this.getAllocatedHeight()
    )

    this.lineNumberGutterArea.setSizeRequest(
      this.measurements.lineNumberGutterWidth,
      this.getAllocatedHeight()
    )
    this.lineNumberGutterArea.update({
      rootComponent: this,
      model: this.model,
      measurements: this.measurements,
      font: this.font,
      // onMouseDown: gutter.onMouseDown,
      // onMouseMove: gutter.onMouseMove,
      // startRow: renderedStartRow,
      // endRow: renderedEndRow,
      // rowsPerTile: rowsPerTile,
      // maxDigits: maxDigits,
      // keys: keys,
      // bufferRows: bufferRows,
      // screenRows: screenRows,
      // softWrappedFlags: softWrappedFlags,
      // foldableFlags: foldableFlags,
      // decorations: decorationsToRender.lineNumbers.get(gutter.name) || [],
      // blockDecorations: decorationsToRender.blocks,
      didMeasureVisibleBlockDecoration: this.didMeasureVisibleBlockDecoration,
      // height: scrollHeight,
      // width,
      // lineHeight: lineHeight,
      // showLineNumbers
    })
  }

  renderText() {
    const {
      textContainerWidth: width,
      textContainerHeight: height,
    } = this.measurements

    this.backgroundArea.update({ width, height })
    this.cursorArea.update({
      width,
      height,
      cursors: this.decorationsToRender.cursors,
    })

    this.textWindow.setSizeRequest(width, height)
    this.textContainer.setSizeRequest(
      this.getScrollWidth(),
      this.getScrollHeight()
    )

    this.renderHighlightDecorations()
    this.renderLineTiles()
    this.queueDraw()
  }

  renderLineTiles() {
    if (!this.hasInitialMeasurements)
      return

    // TODO: renderHighlightDecorations

    const { lineComponentsByScreenLineId } = this;

    const startRow = this.getRenderedStartRow();
    const endRow = this.getRenderedEndRow();
    const rowsPerTile = this.getRowsPerTile();
    const tileWidth = this.getScrollWidth();

    for (let i = 0; i < this.renderedTileStartRows.length; i++) {
      const tileStartRow = this.renderedTileStartRows[i];
      const tileEndRow = Math.min(endRow, tileStartRow + rowsPerTile);
      const tileHeight =
        this.pixelPositionBeforeBlocksForRow(tileEndRow) -
        this.pixelPositionBeforeBlocksForRow(tileStartRow);
      const top = this.pixelPositionBeforeBlocksForRow(tileStartRow)


      const tileId = this.idsByTileStartRow.get(tileStartRow)
      let tile
      const props = {
        key: tileId,
        element: this,
        parent: this.textContainer,
        measuredContent: this.measuredContent,
        height: tileHeight,
        width: tileWidth,
        top: top,
        font: this.font,
        measurements: this.measurements,
        renderedStartRow: startRow,
        tileStartRow,
        tileEndRow,
        screenLines: this.renderedScreenLines.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        lineDecorations: this.decorationsToRender.lines.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        textDecorations: this.decorationsToRender.text.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        highlightDecorations: this.decorationsToRender.highlights.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        blockDecorations: this.decorationsToRender.blocks.get(tileStartRow),
        displayLayer: this.model.displayLayer,
        lineComponentsByScreenLineId
      }

      if (this.tilesById.has(tileId)) {
        tile = this.tilesById.get(tileId)
        tile.update(props)
      }
      else {
        tile = new LinesTileComponent(props)
        this.tilesById.set(tileId, tile)
      }
    }
  }

  renderHighlightDecorations() {
    const { measurements } = this
    const {
      lineHeight,
      horizontalPadding,
      textContainerWidth: width,
      textContainerHeight: height,
    } = measurements
    const highlightDecorations = this.decorationsToRender.highlights

    this.highlightsArea.update({
      width,
      height,
      lineHeight,
      horizontalPadding,
      highlightDecorations: highlightDecorations.slice(),
      hasInitialMeasurements: this.hasInitialMeasurements,
    })
  }

  etchUpdateSync() {
    this.queueDraw()
  }

  /* copied functions below */

  update(props) {
    const newProps = Object.assign({}, this.props, props);
    if (newProps.model !== this.model) {
      if (this.model)
        this.model.component = null;
      newProps.model.component = this;
      this.model = props.model
    }
    if (newProps.mini !== this.props.mini) {
      if (newProps.mini)
        this.addCssClass('mini')
      else
        this.removeCssClass('mini')
    }
    if (newProps.readOnly !== this.props.readOnly) {
      if (newProps.readOnly)
        this.addCssClass('readonly')
      else
        this.removeCssClass('readonly')
    }
    this.props = newProps;
    this.scheduleUpdate();
  }

  setCursorType(cursorType) {
    this.props.cursorType = cursorType
  }

  setCursorBlink(cursorBlink) {
    this.props.cursorBlink = cursorBlink
    if (cursorBlink)
      this.startCursorBlinking()
    else
      this.stopCursorBlinking()
  }

  pixelPositionForScreenPosition({ row, column }) {
    const top = this.pixelPositionAfterBlocksForRow(row);
    let left = this.pixelLeftForRowAndColumn(row, column);
    if (left == null) {
      this.requestHorizontalMeasurement(row, column);
      this.updateSync();
      left = this.pixelLeftForRowAndColumn(row, column);
    }
    // FIXME: normalize this among all pixel returning methods
    left += this.measurements.horizontalPadding
    return { top, left };
  }

  scheduleUpdate(nextUpdateOnlyBlinksCursors = false) {
    if (!this._visible) return;
    if (this.suppressUpdates) return;

    this.nextUpdateOnlyBlinksCursors =
      this.nextUpdateOnlyBlinksCursors !== false &&
      nextUpdateOnlyBlinksCursors === true;

    if (!this.updateScheduled) {
      this.updateScheduled = true
      process.nextTick(() => {
        this.updateSync();
      })
    }
  }

  updateSync(useScheduler = false) {
    // Don't proceed if we know we are not visible
    if (!this._visible) {
      this.updateScheduled = false;
      return;
    }

    // Don't proceed if we have to pay for a measurement anyway and detect
    // that we are no longer visible.
    if (
      (this.remeasureCharacterDimensions ||
        this.remeasureAllBlockDecorations) &&
      !this.isVisible()
    ) {
      if (this.resolveNextUpdatePromise) this.resolveNextUpdatePromise();
      this.updateScheduled = false;
      return;
    }

    const onlyBlinkingCursors = this.nextUpdateOnlyBlinksCursors;
    this.nextUpdateOnlyBlinksCursors = null;
    if (/* useScheduler && */ onlyBlinkingCursors) {
      this.cursorArea.queueDraw()
      if (this.resolveNextUpdatePromise) this.resolveNextUpdatePromise();
      this.updateScheduled = false;
      return;
    }

    if (this.remeasureCharacterDimensions) {
      const originalLineHeight = this.getLineHeight();
      const originalBaseCharacterWidth = this.getBaseCharacterWidth();
      const scrollTopRow = this.getScrollTopRow();
      const scrollLeftColumn = this.getScrollLeftColumn();

      this.measureCharacterDimensions();
      this.measureGutterDimensions();
      this.queryLongestLine();

      if (this.getLineHeight() !== originalLineHeight) {
        this.setScrollTopRow(scrollTopRow);
      }
      if (this.getBaseCharacterWidth() !== originalBaseCharacterWidth) {
        this.setScrollLeftColumn(scrollLeftColumn);
      }
      this.remeasureCharacterDimensions = false;
    }

    this.measureBlockDecorations();

    this.updateSyncBeforeMeasuringContent();
    this.updateAbsolutePositionedDecorations();
    this.render()

    const restartFrame = this.measureContentDuringUpdateSync();
    if (restartFrame) {
      this.updateSync(false);
    } else {
      this.updateSyncAfterMeasuringContent();
    }

    this.updateScheduled = false;
  }

  measureBlockDecorations() {
    if (this.remeasureAllBlockDecorations) {
      this.remeasureAllBlockDecorations = false;

      const decorations = this.model.getDecorations();
      for (let i = 0; i < decorations.length; i++) {
        const decoration = decorations[i];
        const marker = decoration.getMarker();
        if (marker.isValid() && decoration.getProperties().type === 'block') {
          this.blockDecorationsToMeasure.add(decoration);
        }
      }

      // Update the width of the line tiles to ensure block decorations are
      // measured with the most recent width.
      if (this.blockDecorationsToMeasure.size > 0) {
        this.updateSyncBeforeMeasuringContent();
      }
    }

    if (this.blockDecorationsToMeasure.size > 0) {
      this.blockDecorationsToMeasure.forEach(decoration => {
        const { item } = decoration.getProperties();
        const [_, natural] = item.getPreferredSize()
        const height = natural.height
        this.heightsByBlockDecoration.set(decoration, height);
        this.lineTopIndex.resizeBlock(decoration, height);
      });
      this.blockDecorationsToMeasure.clear();
      this.didMeasureVisibleBlockDecoration = true;
    }
  }

  updateSyncBeforeMeasuringContent() {
    this.measuredContent = false;
    this.derivedDimensionsCache = {};
    this.updateModelSoftWrapColumn();
    if (this.pendingAutoscroll) {
      let { screenRange, options } = this.pendingAutoscroll;
      this.autoscrollVertically(screenRange, options);
      this.requestHorizontalMeasurement(
        screenRange.start.row,
        screenRange.start.column
      );
      this.requestHorizontalMeasurement(
        screenRange.end.row,
        screenRange.end.column
      );
    }
    this.populateVisibleRowRange(this.getRenderedStartRow());
    this.populateVisibleTiles();
    this.queryScreenLinesToRender();
    this.queryLongestLine();
    this.queryLineNumbersToRender();
    this.queryGuttersToRender();
    this.queryDecorationsToRender();
    this.queryExtraScreenLinesToRender();
    this.shouldRenderDummyScrollbars = !this.remeasureScrollbars;

    this.etchUpdateSync()
    // this.etchUpdateSync();
    // this.updateClassList();

    this.shouldRenderDummyScrollbars = true;
    this.didMeasureVisibleBlockDecoration = false;
  }

  measureContentDuringUpdateSync() {
    let gutterDimensionsChanged = false;
    if (this.remeasureGutterDimensions) {
      gutterDimensionsChanged = this.measureGutterDimensions();
      this.remeasureGutterDimensions = false;
    }
    const wasHorizontalScrollbarVisible =
      this.canScrollHorizontally() && this.getHorizontalScrollbarHeight() > 0;

    this.measureLongestLineWidth();
    this.measureHorizontalPositions();

    const isHorizontalScrollbarVisible =
      this.canScrollHorizontally() && this.getHorizontalScrollbarHeight() > 0;

    if (this.pendingAutoscroll) {
      this.derivedDimensionsCache = {};
      const { screenRange, options } = this.pendingAutoscroll;
      this.autoscrollHorizontally(screenRange, options);

      if (!wasHorizontalScrollbarVisible && isHorizontalScrollbarVisible) {
        this.autoscrollVertically(screenRange, options);
      }
      this.pendingAutoscroll = null;
    }

    this.linesToMeasure.clear();
    this.measuredContent = true;

    return (
      gutterDimensionsChanged ||
      wasHorizontalScrollbarVisible !== isHorizontalScrollbarVisible
    );
  }

  updateSyncAfterMeasuringContent() {
    this.derivedDimensionsCache = {};
    this.etchUpdateSync();

    this.currentFrameLineNumberGutterProps = null;
    this.scrollTopPending = false;
    this.scrollLeftPending = false;
    if (this.remeasureScrollbars) {
      // Flush stored scroll positions to the vertical and the horizontal
      // scrollbars. This is because they have just been destroyed and recreated
      // as a result of their remeasurement, but we could not assign the scroll
      // top while they were initialized because they were not attached to the
      // DOM yet.
      this.refs.verticalScrollbar.flushScrollPosition();
      this.refs.horizontalScrollbar.flushScrollPosition();

      this.measureScrollbarDimensions();
      this.remeasureScrollbars = false;
      this.etchUpdateSync();
    }

    this.derivedDimensionsCache = {};
    if (this.resolveNextUpdatePromise) this.resolveNextUpdatePromise();
  }

  /* render functions */

  queryScreenLinesToRender() {
    const { model } = this;

    this.renderedScreenLines = model.displayLayer.getScreenLines(
      this.getRenderedStartRow(),
      this.getRenderedEndRow()
    );
  }

  queryLongestLine() {
    const { model } = this;

    const longestLineRow = model.getApproximateLongestScreenRow();
    const longestLine = model.screenLineForScreenRow(longestLineRow);
    if (
      longestLine !== this.previousLongestLine ||
      this.remeasureCharacterDimensions
    ) {
      this.requestLineToMeasure(longestLineRow, longestLine);
      this.longestLineToMeasure = longestLine;
      this.previousLongestLine = longestLine;
    }
  }

  queryExtraScreenLinesToRender() {
    this.extraRenderedScreenLines.clear();
    this.linesToMeasure.forEach((screenLine, row) => {
      if (row < this.getRenderedStartRow() || row >= this.getRenderedEndRow()) {
        this.extraRenderedScreenLines.set(row, screenLine);
      }
    });
  }

  queryLineNumbersToRender() {
    const { model } = this;
    if (!model.anyLineNumberGutterVisible()) return;
    if (this.showLineNumbers !== model.doesShowLineNumbers()) {
      this.remeasureGutterDimensions = true;
      this.showLineNumbers = model.doesShowLineNumbers();
    }

    // FIXME: uncomment this?
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

  renderedScreenLineForRow(row) {
    return (
      this.renderedScreenLines[row - this.getRenderedStartRow()] ||
      this.extraRenderedScreenLines.get(row)
    );
  }

  queryGuttersToRender() {
    const oldGuttersToRender = this.guttersToRender;
    const oldGuttersVisibility = this.guttersVisibility;
    this.guttersToRender = this.model.getGutters();
    this.guttersVisibility = this.guttersToRender.map(g => g.visible);

    if (
      !oldGuttersToRender ||
      oldGuttersToRender.length !== this.guttersToRender.length
    ) {
      this.remeasureGutterDimensions = true;
    } else {
      for (let i = 0, length = this.guttersToRender.length; i < length; i++) {
        if (
          this.guttersToRender[i] !== oldGuttersToRender[i] ||
          this.guttersVisibility[i] !== oldGuttersVisibility[i]
        ) {
          this.remeasureGutterDimensions = true;
          break;
        }
      }
    }
  }

  queryDecorationsToRender() {
    this.decorationsToRender.lineNumbers.clear();
    this.decorationsToRender.lines = [];
    this.decorationsToRender.overlays.length = 0;
    this.decorationsToRender.customGutter.clear();
    this.decorationsToRender.blocks = new Map();
    this.decorationsToRender.text = [];
    this.decorationsToMeasure.highlights.length = 0;
    this.decorationsToMeasure.cursors.clear();
    this.textDecorationsByMarker.clear();
    this.textDecorationBoundaries.length = 0;

    const decorationsByMarker = this.model.decorationManager.decorationPropertiesByMarkerForScreenRowRange(
      this.getRenderedStartRow(),
      this.getRenderedEndRow()
    );

    decorationsByMarker.forEach((decorations, marker) => {
      const screenRange = marker.getScreenRange();
      const reversed = marker.isReversed();
      for (let i = 0; i < decorations.length; i++) {
        const decoration = decorations[i];
        this.addDecorationToRender(
          decoration.type,
          decoration,
          marker,
          screenRange,
          reversed
        );
      }
    });

    this.populateTextDecorationsToRender();
  }

  addDecorationToRender(type, decoration, marker, screenRange, reversed) {
    if (Array.isArray(type)) {
      for (let i = 0, length = type.length; i < length; i++) {
        this.addDecorationToRender(
          type[i],
          decoration,
          marker,
          screenRange,
          reversed
        );
      }
    } else {
      switch (type) {
        case 'line':
        case 'line-number':
          this.addLineDecorationToRender(
            type,
            decoration,
            screenRange,
            reversed
          );
          break;
        case 'highlight':
          this.addHighlightDecorationToMeasure(
            decoration,
            screenRange,
            marker.id
          );
          break;
        case 'cursor':
          this.addCursorDecorationToMeasure(
            decoration,
            marker,
            screenRange,
            reversed
          );
          break;
        case 'overlay':
          this.addOverlayDecorationToRender(decoration, marker);
          break;
        case 'gutter':
          this.addCustomGutterDecorationToRender(decoration, screenRange);
          break;
        case 'block':
          this.addBlockDecorationToRender(decoration, screenRange, reversed);
          break;
        case 'text':
          this.addTextDecorationToRender(decoration, screenRange, marker);
          break;
      }
    }
  }

  addLineDecorationToRender(type, decoration, screenRange, reversed) {
    let decorationsToRender;
    if (type === 'line') {
      decorationsToRender = this.decorationsToRender.lines;
    } else {
      const gutterName = decoration.gutterName || 'line-number';
      decorationsToRender = this.decorationsToRender.lineNumbers.get(
        gutterName
      );
      if (!decorationsToRender) {
        decorationsToRender = [];
        this.decorationsToRender.lineNumbers.set(
          gutterName,
          decorationsToRender
        );
      }
    }

    let omitLastRow = false;
    if (screenRange.isEmpty()) {
      if (decoration.onlyNonEmpty) return;
    } else {
      if (decoration.onlyEmpty) return;
      if (decoration.omitEmptyLastRow !== false) {
        omitLastRow = screenRange.end.column === 0;
      }
    }

    const renderedStartRow = this.getRenderedStartRow();
    let rangeStartRow = screenRange.start.row;
    let rangeEndRow = screenRange.end.row;

    if (decoration.onlyHead) {
      if (reversed) {
        rangeEndRow = rangeStartRow;
      } else {
        rangeStartRow = rangeEndRow;
      }
    }

    rangeStartRow = Math.max(rangeStartRow, this.getRenderedStartRow());
    rangeEndRow = Math.min(rangeEndRow, this.getRenderedEndRow() - 1);

    for (let row = rangeStartRow; row <= rangeEndRow; row++) {
      if (omitLastRow && row === screenRange.end.row) break;
      const currentClassName = decorationsToRender[row - renderedStartRow];
      const newClassName = currentClassName
        ? currentClassName + ' ' + decoration.class
        : decoration.class;
      decorationsToRender[row - renderedStartRow] = newClassName;
    }
  }

  addHighlightDecorationToMeasure(decoration, screenRange, key) {
    screenRange = constrainRangeToRows(
      screenRange,
      this.getRenderedStartRow(),
      this.getRenderedEndRow()
    );
    if (screenRange.isEmpty()) return;

    const {
      class: className,
      flashRequested,
      flashClass,
      flashDuration
    } = decoration;
    decoration.flashRequested = false;
    this.decorationsToMeasure.highlights.push({
      screenRange,
      key,
      className,
      flashRequested,
      flashClass,
      flashDuration
    });
    this.requestHorizontalMeasurement(
      screenRange.start.row,
      screenRange.start.column
    );
    this.requestHorizontalMeasurement(
      screenRange.end.row,
      screenRange.end.column
    );
  }

  addCursorDecorationToMeasure(decoration, marker, screenRange, reversed) {
    const { model } = this;
    if (!model.getShowCursorOnSelection() && !screenRange.isEmpty()) return;

    let decorationToMeasure = this.decorationsToMeasure.cursors.get(marker);
    if (!decorationToMeasure) {
      const isLastCursor = model.getLastCursor().getMarker() === marker;
      const screenPosition = reversed ? screenRange.start : screenRange.end;
      const { row, column } = screenPosition;

      if (row < this.getRenderedStartRow() || row >= this.getRenderedEndRow())
        return;

      this.requestHorizontalMeasurement(row, column);
      let columnWidth = 0;
      if (model.lineLengthForScreenRow(row) > column) {
        columnWidth = 1;
        this.requestHorizontalMeasurement(row, column + 1);
      }
      decorationToMeasure = { screenPosition, columnWidth, isLastCursor };
      this.decorationsToMeasure.cursors.set(marker, decorationToMeasure);
    }

    if (decoration.class) {
      if (decorationToMeasure.className) {
        decorationToMeasure.className += ' ' + decoration.class;
      } else {
        decorationToMeasure.className = decoration.class;
      }
    }

    if (decoration.style) {
      if (decorationToMeasure.style) {
        Object.assign(decorationToMeasure.style, decoration.style);
      } else {
        decorationToMeasure.style = Object.assign({}, decoration.style);
      }
    }
  }

  addOverlayDecorationToRender(decoration, marker) {
    const { class: className, item, position, avoidOverflow } = decoration;
    const element = TextEditor.viewForItem(item);
    const screenPosition =
      position === 'tail'
        ? marker.getTailScreenPosition()
        : marker.getHeadScreenPosition();

    this.requestHorizontalMeasurement(
      screenPosition.row,
      screenPosition.column
    );
    this.decorationsToRender.overlays.push({
      className,
      element,
      avoidOverflow,
      screenPosition
    });
  }

  addCustomGutterDecorationToRender(decoration, screenRange) {
    let decorations = this.decorationsToRender.customGutter.get(
      decoration.gutterName
    );
    if (!decorations) {
      decorations = [];
      this.decorationsToRender.customGutter.set(
        decoration.gutterName,
        decorations
      );
    }
    const top = this.pixelPositionAfterBlocksForRow(screenRange.start.row);
    const height =
      this.pixelPositionBeforeBlocksForRow(screenRange.end.row + 1) - top;

    decorations.push({
      className:
        'decoration' + (decoration.class ? ' ' + decoration.class : ''),
      element: TextEditor.viewForItem(decoration),
      top,
      height
    });
  }

  addBlockDecorationToRender(decoration, screenRange, reversed) {
    const { row } = reversed ? screenRange.start : screenRange.end;
    if (row < this.getRenderedStartRow() || row >= this.getRenderedEndRow())
      return;

    const tileStartRow = this.tileStartRowForRow(row);
    const screenLine = this.renderedScreenLines[
      row - this.getRenderedStartRow()
    ];

    let decorationsByScreenLine = this.decorationsToRender.blocks.get(
      tileStartRow
    );
    if (!decorationsByScreenLine) {
      decorationsByScreenLine = new Map();
      this.decorationsToRender.blocks.set(
        tileStartRow,
        decorationsByScreenLine
      );
    }

    let decorations = decorationsByScreenLine.get(screenLine.id);
    if (!decorations) {
      decorations = [];
      decorationsByScreenLine.set(screenLine.id, decorations);
    }
    decorations.push(decoration);

    // Order block decorations by increasing values of their "order" property. Break ties with "id", which mirrors
    // their creation sequence.
    decorations.sort((a, b) =>
      a.order !== b.order ? a.order - b.order : a.id - b.id
    );
  }

  addTextDecorationToRender(decoration, screenRange, marker) {
    if (screenRange.isEmpty()) return;

    let decorationsForMarker = this.textDecorationsByMarker.get(marker);
    if (!decorationsForMarker) {
      decorationsForMarker = [];
      this.textDecorationsByMarker.set(marker, decorationsForMarker);
      this.textDecorationBoundaries.push({
        position: screenRange.start,
        starting: [marker]
      });
      this.textDecorationBoundaries.push({
        position: screenRange.end,
        ending: [marker]
      });
    }
    decorationsForMarker.push(decoration);
  }

  populateTextDecorationsToRender() {
    // Sort all boundaries in ascending order of position
    this.textDecorationBoundaries.sort((a, b) =>
      a.position.compare(b.position)
    );

    // Combine adjacent boundaries with the same position
    for (let i = 0; i < this.textDecorationBoundaries.length; ) {
      const boundary = this.textDecorationBoundaries[i];
      const nextBoundary = this.textDecorationBoundaries[i + 1];
      if (nextBoundary && nextBoundary.position.isEqual(boundary.position)) {
        if (nextBoundary.starting) {
          if (boundary.starting) {
            boundary.starting.push(...nextBoundary.starting);
          } else {
            boundary.starting = nextBoundary.starting;
          }
        }

        if (nextBoundary.ending) {
          if (boundary.ending) {
            boundary.ending.push(...nextBoundary.ending);
          } else {
            boundary.ending = nextBoundary.ending;
          }
        }

        this.textDecorationBoundaries.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    const renderedStartRow = this.getRenderedStartRow();
    const renderedEndRow = this.getRenderedEndRow();
    const containingMarkers = [];

    // Iterate over boundaries to build up text decorations.
    for (let i = 0; i < this.textDecorationBoundaries.length; i++) {
      const boundary = this.textDecorationBoundaries[i];

      // If multiple markers start here, sort them by order of nesting (markers ending later come first)
      if (boundary.starting && boundary.starting.length > 1) {
        boundary.starting.sort((a, b) => a.compare(b));
      }

      // If multiple markers start here, sort them by order of nesting (markers starting earlier come first)
      if (boundary.ending && boundary.ending.length > 1) {
        boundary.ending.sort((a, b) => b.compare(a));
      }

      // Remove markers ending here from containing markers array
      if (boundary.ending) {
        for (let j = boundary.ending.length - 1; j >= 0; j--) {
          containingMarkers.splice(
            containingMarkers.lastIndexOf(boundary.ending[j]),
            1
          );
        }
      }
      // Add markers starting here to containing markers array
      if (boundary.starting) containingMarkers.push(...boundary.starting);

      // Determine desired className and style based on containing markers
      let className, style;
      for (let j = 0; j < containingMarkers.length; j++) {
        const marker = containingMarkers[j];
        const decorations = this.textDecorationsByMarker.get(marker);
        for (let k = 0; k < decorations.length; k++) {
          const decoration = decorations[k];
          if (decoration.class) {
            if (className) {
              className += ' ' + decoration.class;
            } else {
              className = decoration.class;
            }
          }
          if (decoration.style) {
            if (style) {
              Object.assign(style, decoration.style);
            } else {
              style = Object.assign({}, decoration.style);
            }
          }
        }
      }

      // Add decoration start with className/style for current position's column,
      // and also for the start of every row up until the next decoration boundary
      if (boundary.position.row >= renderedStartRow) {
        this.addTextDecorationStart(
          boundary.position.row,
          boundary.position.column,
          className,
          style
        );
      }
      const nextBoundary = this.textDecorationBoundaries[i + 1];
      if (nextBoundary) {
        let row = Math.max(boundary.position.row + 1, renderedStartRow);
        const endRow = Math.min(nextBoundary.position.row, renderedEndRow);
        for (; row < endRow; row++) {
          this.addTextDecorationStart(row, 0, className, style);
        }

        if (
          row === nextBoundary.position.row &&
          nextBoundary.position.column !== 0
        ) {
          this.addTextDecorationStart(row, 0, className, style);
        }
      }
    }
  }

  addTextDecorationStart(row, column, className, style) {
    const renderedStartRow = this.getRenderedStartRow();
    let decorationStarts = this.decorationsToRender.text[
      row - renderedStartRow
    ];
    if (!decorationStarts) {
      decorationStarts = [];
      this.decorationsToRender.text[row - renderedStartRow] = decorationStarts;
    }
    decorationStarts.push({ column, className, style });
  }

  updateAbsolutePositionedDecorations() {
    this.updateHighlightsToRender();
    this.updateCursorsToRender();
    this.updateOverlaysToRender();
  }

  updateHighlightsToRender() {
    this.decorationsToRender.highlights.length = 0;
    for (let i = 0; i < this.decorationsToMeasure.highlights.length; i++) {
      const highlight = this.decorationsToMeasure.highlights[i];
      const { start, end } = highlight.screenRange;
      highlight.startPixelTop = this.pixelPositionAfterBlocksForRow(start.row);
      highlight.startPixelLeft = this.pixelLeftForRowAndColumn(
        start.row,
        start.column
      );
      highlight.endPixelTop =
        this.pixelPositionAfterBlocksForRow(end.row) + this.getLineHeight();
      highlight.endPixelLeft = this.pixelLeftForRowAndColumn(
        end.row,
        end.column
      );
      this.decorationsToRender.highlights.push(highlight);
    }
  }

  updateCursorsToRender() {
    this.decorationsToRender.cursors.length = 0;

    this.decorationsToMeasure.cursors.forEach(cursor => {
      const { screenPosition, className, style } = cursor;
      let { row, column } = screenPosition;

      // FIXME: this is a hack to support vim-mode-plus cursor styles
      if (style && style.left === '-1ch')
        column -= 1;

      if (style && style.top)
        row += Math.round(parseInt(style.top.replace('px', ''), 10) / this.measurements.lineHeight)

      const pixelTop = this.pixelPositionAfterBlocksForRow(row);
      const pixelLeft = this.pixelLeftForRowAndColumn(row, column);
      let pixelWidth;
      if (cursor.columnWidth === 0) {
        pixelWidth = this.getBaseCharacterWidth();
      } else {
        pixelWidth = this.pixelLeftForRowAndColumn(row, column + 1) - pixelLeft;
      }

      const screenLine = this.model.screenLineForScreenRow(row)
      const character =
          column < screenLine.lineText.length ?  screenLine.lineText[column] :
        column === screenLine.lineText.length ?  ' ' : 'X'

      const cursorPosition = {
        row,
        column,
        pixelTop,
        pixelLeft,
        pixelWidth,
        character,
        className,
        style,
      };
      this.decorationsToRender.cursors.push(cursorPosition);
      if (cursor.isLastCursor) this.hiddenInputPosition = cursorPosition;
    });
  }

  updateOverlayToRender(decoration) {
    const windowInnerHeight = this.getWindowInnerHeight();
    const windowInnerWidth = this.getWindowInnerWidth();
    const contentClientRect = this.refs.content.getBoundingClientRect();

    const { element, screenPosition, avoidOverflow } = decoration;
    const { row, column } = screenPosition;
    let wrapperTop =
      contentClientRect.top +
      this.pixelPositionAfterBlocksForRow(row) +
      this.getLineHeight();
    let wrapperLeft =
      contentClientRect.left + this.pixelLeftForRowAndColumn(row, column);
    const clientRect = element.getBoundingClientRect();

    if (avoidOverflow !== false) {
      const computedStyle = window.getComputedStyle(element);
      const elementTop = wrapperTop + parseInt(computedStyle.marginTop);
      const elementBottom = elementTop + clientRect.height;
      const flippedElementTop =
        wrapperTop -
        this.getLineHeight() -
        clientRect.height -
        parseInt(computedStyle.marginBottom);
      const elementLeft = wrapperLeft + parseInt(computedStyle.marginLeft);
      const elementRight = elementLeft + clientRect.width;

      if (elementBottom > windowInnerHeight && flippedElementTop >= 0) {
        wrapperTop -= elementTop - flippedElementTop;
      }
      if (elementLeft < 0) {
        wrapperLeft -= elementLeft;
      } else if (elementRight > windowInnerWidth) {
        wrapperLeft -= elementRight - windowInnerWidth;
      }
    }

    decoration.pixelTop = Math.round(wrapperTop);
    decoration.pixelLeft = Math.round(wrapperLeft);
  }

  updateOverlaysToRender() {
    const overlayCount = this.decorationsToRender.overlays.length;
    if (overlayCount === 0) return null;

    for (let i = 0; i < overlayCount; i++) {
      const decoration = this.decorationsToRender.overlays[i];
      this.updateOverlayToRender(decoration);
    }
  }

  didAttach() {
    if (this.attached)
      return

    this.attached = true;

    // TODO: handle didResize & didResizeGutterContainer
    // this.resizeObserver = new ResizeObserver(this.didResize.bind(this));
    // this.resizeObserver.observe(this.element);
    // if (this.refs.gutterContainer) {
    //   this.gutterContainerResizeObserver = new ResizeObserver(
    //     this.didResizeGutterContainer.bind(this)
    //   );
    //   this.gutterContainerResizeObserver.observe(
    //     this.refs.gutterContainer.element
    //   );
    // }
    this.remeasureAllBlockDecorations = true;

    this.overlayComponents.forEach(component => component.didAttach());

    if (this.isVisible()) {
      this.didShow();
    } else {
      this.didHide();
    }
    if (!this.constructor.attachedComponents) {
      this.constructor.attachedComponents = new Set();
    }
    this.constructor.attachedComponents.add(this);

    this.didSizeAllocate()
  }

  didDetach() {
    if (this.attached) {
      // this.intersectionObserver.disconnect();
      // this.resizeObserver.disconnect();
      if (this.gutterContainerResizeObserver)
        this.gutterContainerResizeObserver.disconnect();
      this.overlayComponents.forEach(component => component.didDetach());

      this.didHide();
      this.attached = false;
      this.constructor.attachedComponents.delete(this);
    }
  }

  didShow() {
    if (!this._visible && this.isVisible()) {
      if (!this.hasInitialMeasurements) this.measureDimensions();
      this._visible = true;
      this.model.setVisible(true);
      this.updateSync();
      this.flushPendingLogicalScrollPosition();
    }
  }

  didHide() {
    if (this._visible) {
      this._visible = false;
      this.model.setVisible(false);
    }
  }

  // Called by TextEditorElement so that focus events can be handled before
  // the element is attached to the DOM.
  didFocus() {
    // This element can be focused from a parent custom element's
    // attachedCallback before *its* attachedCallback is fired. This protects
    // against that case.
    if (!this.attached) this.didAttach();

    // The element can be focused before the intersection observer detects that
    // it has been shown for the first time. If this element is being focused,
    // it is necessarily visible, so we call `didShow` to ensure the hidden
    // input is rendered before we try to shift focus to it.
    if (!this._visible) this.didShow();

    if (!this.focused) {
      this.focused = true;
      this.startCursorBlinking();
      this.scheduleUpdate();
    }
  }

  // Called by TextEditorElement so that this function is always the first
  // listener to be fired, even if other listeners are bound before creating
  // the component.
  didBlur() {
    this.focused = false;
    this.stopCursorBlinking();
    this.scheduleUpdate();
  }

  didMouseWheel(event) {
    const scrollSensitivity = this.model.getScrollSensitivity() / 100;

    let { wheelDeltaX, wheelDeltaY } = event;

    if (Math.abs(wheelDeltaX) > Math.abs(wheelDeltaY)) {
      wheelDeltaX = wheelDeltaX * scrollSensitivity;
      wheelDeltaY = 0;
    } else {
      wheelDeltaX = 0;
      wheelDeltaY = wheelDeltaY * scrollSensitivity;
    }

    if (this.getPlatform() !== 'darwin' && event.shiftKey) {
      let temp = wheelDeltaX;
      wheelDeltaX = wheelDeltaY;
      wheelDeltaY = temp;
    }

    const scrollLeftChanged =
      wheelDeltaX !== 0 &&
      this.setScrollLeft(this.getScrollLeft() - wheelDeltaX);
    const scrollTopChanged =
      wheelDeltaY !== 0 && this.setScrollTop(this.getScrollTop() - wheelDeltaY);

    if (scrollLeftChanged || scrollTopChanged) {
      event.preventDefault();
      this.updateSync();
    }
  }

  didSizeAllocate() {
    if (!this.attached)
      return

    const width = this.getAllocatedWidth()
    const height = this.getAllocatedHeight()

    let changed = false
    if (this.previousWidth !== width)
      changed = true
    if (this.previousHeight !== height)
      changed = true

    this.previousWidth = width
    this.previousHeight = height

    if (changed)
      this.didResize()
  }

  didResize() {
    // Prevent the component from measuring the client container dimensions when
    // getting spurious resize events.
    if (!this.isVisible())
      return

    const clientContainerWidthChanged  = this.measureClientContainerWidth();
    const clientContainerHeightChanged = this.measureClientContainerHeight();

    if (clientContainerWidthChanged || clientContainerHeightChanged) {
      if (clientContainerWidthChanged) {
        this.remeasureAllBlockDecorations = true;
      }

      this.measureDimensions()

      // this.resizeObserver.disconnect();
      this.scheduleUpdate();
      /* process.nextTick(() => {
        *   this.resizeObserver.observe(this.element);
        * }); */
    }
  }

  didResizeGutterContainer() {
    // Prevent the component from measuring the gutter dimensions when getting
    // spurious resize events.
    if (this.isVisible() && this.measureGutterDimensions()) {
      this.gutterContainerResizeObserver.disconnect();
      this.scheduleUpdate();
      process.nextTick(() => {
        this.gutterContainerResizeObserver.observe(
          this.refs.gutterContainer.element
        );
      });
    }
  }

  didChange() {
    // FIXME: granularize updates
    this.scheduleUpdate()
  }

  didChangeCursorPosition() {
    // FIXME: granularize updates
    this.scheduleUpdate()
  }

  didScroll() {
    this.scheduleUpdate()
    // this.renderGutter()
    this.derivedDimensionsCache = {};
  }

  didUpdateStyles() {
    this.remeasureCharacterDimensions = true;
    this.horizontalPixelPositionsByScreenLineId.clear();
    this.scheduleUpdate();
  }

  didTextInput(event) {
    if (this.compositionCheckpoint) {
      this.model.revertToCheckpoint(this.compositionCheckpoint);
      this.compositionCheckpoint = null;
    }

    if (this.isInputEnabled()) {
      event.stopPropagation();

      // WARNING: If we call preventDefault on the input of a space
      // character, then the browser interprets the spacebar keypress as a
      // page-down command, causing spaces to scroll elements containing
      // editors. This means typing space will actually change the contents
      // of the hidden input, which will cause the browser to autoscroll the
      // scroll container to reveal the input if it is off screen (See
      // https://github.com/atom/atom/issues/16046). To correct for this
      // situation, we automatically reset the scroll position to 0,0 after
      // typing a space. None of this can really be tested.
      if (event.data === ' ') {
        setImmediate(() => {
          this.refs.scrollContainer.scrollTop = 0;
          this.refs.scrollContainer.scrollLeft = 0;
        });
      } else {
        event.preventDefault();
      }

      // If the input event is fired while the accented character menu is open it
      // means that the user has chosen one of the accented alternatives. Thus, we
      // will replace the original non accented character with the selected
      // alternative.
      if (this.accentedCharacterMenuIsOpen) {
        this.model.selectLeft();
      }

      this.model.insertText(event.data, { groupUndo: true });
    }
  }

  // We need to get clever to detect when the accented character menu is
  // opened on macOS. Usually, every keydown event that could cause input is
  // followed by a corresponding keypress. However, pressing and holding
  // long enough to open the accented character menu causes additional keydown
  // events to fire that aren't followed by their own keypress and textInput
  // events.
  //
  // Therefore, we assume the accented character menu has been deployed if,
  // before observing any keyup event, we observe events in the following
  // sequence:
  //
  // keydown(code: X), keypress, keydown(code: X)
  //
  // The code X must be the same in the keydown events that bracket the
  // keypress, meaning we're *holding* the _same_ key we intially pressed.
  // Got that?
  didKeydown(event) {
    this.pauseCursorBlinking()
    return
    // FIXME: handle this

    // Stop dragging when user interacts with the keyboard. This prevents
    // unwanted selections in the case edits are performed while selecting text
    // at the same time. Modifier keys are exempt to preserve the ability to
    // add selections, shift-scroll horizontally while selecting.
    if (
      this.stopDragging &&
      event.key !== 'Control' &&
      event.key !== 'Alt' &&
      event.key !== 'Meta' &&
      event.key !== 'Shift'
    ) {
      this.stopDragging();
    }

    if (this.lastKeydownBeforeKeypress != null) {
      if (this.lastKeydownBeforeKeypress.code === event.code) {
        this.accentedCharacterMenuIsOpen = true;
      }

      this.lastKeydownBeforeKeypress = null;
    }

    this.lastKeydown = event;
  }

  didKeypress(event) {
    this.lastKeydownBeforeKeypress = this.lastKeydown;

    // This cancels the accented character behavior if we type a key normally
    // with the menu open.
    this.accentedCharacterMenuIsOpen = false;
  }

  didKeyup(event) {
    if (
      this.lastKeydownBeforeKeypress &&
      this.lastKeydownBeforeKeypress.code === event.code
    ) {
      this.lastKeydownBeforeKeypress = null;
    }
  }

  // The IME composition events work like this:
  //
  // User types 's', chromium pops up the completion helper
  //   1. compositionstart fired
  //   2. compositionupdate fired; event.data == 's'
  // User hits arrow keys to move around in completion helper
  //   3. compositionupdate fired; event.data == 's' for each arry key press
  // User escape to cancel OR User chooses a completion
  //   4. compositionend fired
  //   5. textInput fired; event.data == the completion string
  didCompositionStart() {
    // Workaround for Chromium not preventing composition events when
    // preventDefault is called on the keydown event that precipitated them.
    if (this.lastKeydown && this.lastKeydown.defaultPrevented) {
      this.getHiddenInput().disabled = true;
      process.nextTick(() => {
        // Disabling the hidden input makes it lose focus as well, so we have to
        // re-enable and re-focus it.
        this.getHiddenInput().disabled = false;
        this.getHiddenInput().focus();
      });
      return;
    }

    this.compositionCheckpoint = this.model.createCheckpoint();
    if (this.accentedCharacterMenuIsOpen) {
      this.model.selectLeft();
    }
  }

  didCompositionUpdate(event) {
    this.model.insertText(event.data, { select: true });
  }

  didCompositionEnd(event) {
    event.target.value = '';
  }

  didMouseDownOnContent(event) {
    const { model } = this;
    const { target, button, detail, ctrlKey, shiftKey, metaKey } = event;
    const platform = this.getPlatform();

    // Ignore clicks on block decorations.
    if (target) {
      let element = target;
      while (element && element !== this.element) {
        if (this.blockDecorationsByElement.has(element)) {
          return;
        }

        element = element.parentElement;
      }
    }

    const screenPosition = this.screenPositionForMouseEvent(event);

    if (button === 1) {
      model.setCursorScreenPosition(screenPosition, { autoscroll: false });

      // On Linux, pasting happens on middle click. A textInput event with the
      // contents of the selection clipboard will be dispatched by the browser
      // automatically on mouseup.
      if (platform === 'linux' && this.isInputEnabled())
        model.insertText(clipboard.readText('selection'));
      return;
    }

    if (button !== 0) return;

    // Ctrl-click brings up the context menu on macOS
    if (platform === 'darwin' && ctrlKey) return;

    if (target && target.matches('.fold-marker')) {
      const bufferPosition = model.bufferPositionForScreenPosition(
        screenPosition
      );
      model.destroyFoldsContainingBufferPositions([bufferPosition], false);
      return;
    }

    const allowMultiCursor = atom.config.get('core.editor.multiCursorOnClick');
    const addOrRemoveSelection =
      allowMultiCursor && (metaKey || (ctrlKey && platform !== 'darwin'));

    switch (detail) {
      case 1:
        if (addOrRemoveSelection) {
          const existingSelection = model.getSelectionAtScreenPosition(
            screenPosition
          );
          if (existingSelection) {
            if (model.hasMultipleCursors()) existingSelection.destroy();
          } else {
            model.addCursorAtScreenPosition(screenPosition, {
              autoscroll: false
            });
          }
        } else {
          if (shiftKey) {
            model.selectToScreenPosition(screenPosition, { autoscroll: false });
          } else {
            model.setCursorScreenPosition(screenPosition, {
              autoscroll: false
            });
          }
        }
        break;
      case 2:
        if (addOrRemoveSelection)
          model.addCursorAtScreenPosition(screenPosition, {
            autoscroll: false
          });
        model.getLastSelection().selectWord({ autoscroll: false });
        break;
      case 3:
        if (addOrRemoveSelection)
          model.addCursorAtScreenPosition(screenPosition, {
            autoscroll: false
          });
        model.getLastSelection().selectLine(null, { autoscroll: false });
        break;
    }

    this.handleMouseDragUntilMouseUp({
      didDrag: event => {
        this.autoscrollOnMouseDrag(event);
        const screenPosition = this.screenPositionForMouseEvent(event);
        model.selectToScreenPosition(screenPosition, {
          suppressSelectionMerge: true,
          autoscroll: false
        });
        this.updateSync();
      },
      didStopDragging: () => {
        model.finalizeSelections();
        model.mergeIntersectingSelections();
        this.updateSync();
      }
    });
  }

  didMouseDownOnLineNumberGutter(event) {
    const { model } = this;
    const { target, button, ctrlKey, shiftKey, metaKey } = event;

    // Only handle mousedown events for left mouse button
    if (button !== 0) return;

    const clickedScreenRow = this.screenPositionForMouseEvent(event).row;
    const startBufferRow = model.bufferPositionForScreenPosition([
      clickedScreenRow,
      0
    ]).row;

    if (
      target &&
      (target.matches('.foldable .icon-right') ||
        target.matches('.folded .icon-right'))
    ) {
      model.toggleFoldAtBufferRow(startBufferRow);
      return;
    }

    const addOrRemoveSelection =
      metaKey || (ctrlKey && this.getPlatform() !== 'darwin');
    const endBufferRow = model.bufferPositionForScreenPosition([
      clickedScreenRow,
      Infinity
    ]).row;
    const clickedLineBufferRange = Range(
      Point(startBufferRow, 0),
      Point(endBufferRow + 1, 0)
    );

    let initialBufferRange;
    if (shiftKey) {
      const lastSelection = model.getLastSelection();
      initialBufferRange = lastSelection.getBufferRange();
      lastSelection.setBufferRange(
        initialBufferRange.union(clickedLineBufferRange),
        {
          reversed: clickedScreenRow < lastSelection.getScreenRange().start.row,
          autoscroll: false,
          preserveFolds: true,
          suppressSelectionMerge: true
        }
      );
    } else {
      initialBufferRange = clickedLineBufferRange;
      if (addOrRemoveSelection) {
        model.addSelectionForBufferRange(clickedLineBufferRange, {
          autoscroll: false,
          preserveFolds: true
        });
      } else {
        model.setSelectedBufferRange(clickedLineBufferRange, {
          autoscroll: false,
          preserveFolds: true
        });
      }
    }

    const initialScreenRange = model.screenRangeForBufferRange(
      initialBufferRange
    );
    this.handleMouseDragUntilMouseUp({
      didDrag: event => {
        this.autoscrollOnMouseDrag(event, true);
        const dragRow = this.screenPositionForMouseEvent(event).row;
        const draggedLineScreenRange = Range(
          Point(dragRow, 0),
          Point(dragRow + 1, 0)
        );
        model
          .getLastSelection()
          .setScreenRange(draggedLineScreenRange.union(initialScreenRange), {
            reversed: dragRow < initialScreenRange.start.row,
            autoscroll: false,
            preserveFolds: true
          });
        this.updateSync();
      },
      didStopDragging: () => {
        model.mergeIntersectingSelections();
        this.updateSync();
      }
    });
  }

  handleMouseDragUntilMouseUp({ didDrag, didStopDragging }) {
    let dragging = false;
    let lastMousemoveEvent;

    const animationFrameLoop = () => {
      window.requestAnimationFrame(() => {
        if (dragging && this._visible) {
          didDrag(lastMousemoveEvent);
          animationFrameLoop();
        }
      });
    };

    function didMouseMove(event) {
      lastMousemoveEvent = event;
      if (!dragging) {
        dragging = true;
        animationFrameLoop();
      }
    }

    function didMouseUp() {
      this.stopDragging = null;
      window.removeEventListener('mousemove', didMouseMove);
      window.removeEventListener('mouseup', didMouseUp, { capture: true });
      if (dragging) {
        dragging = false;
        didStopDragging();
      }
    }

    window.addEventListener('mousemove', didMouseMove);
    window.addEventListener('mouseup', didMouseUp, { capture: true });
    this.stopDragging = didMouseUp;
  }

  autoscrollOnMouseDrag({ clientX, clientY }, verticalOnly = false) {
    var {
      top,
      bottom,
      left,
      right
    } = this.refs.scrollContainer.getBoundingClientRect(); // Using var to avoid deopt on += assignments below
    top += MOUSE_DRAG_AUTOSCROLL_MARGIN;
    bottom -= MOUSE_DRAG_AUTOSCROLL_MARGIN;
    left += MOUSE_DRAG_AUTOSCROLL_MARGIN;
    right -= MOUSE_DRAG_AUTOSCROLL_MARGIN;

    let yDelta, yDirection;
    if (clientY < top) {
      yDelta = top - clientY;
      yDirection = -1;
    } else if (clientY > bottom) {
      yDelta = clientY - bottom;
      yDirection = 1;
    }

    let xDelta, xDirection;
    if (clientX < left) {
      xDelta = left - clientX;
      xDirection = -1;
    } else if (clientX > right) {
      xDelta = clientX - right;
      xDirection = 1;
    }

    let scrolled = false;
    if (yDelta != null) {
      const scaledDelta = scaleMouseDragAutoscrollDelta(yDelta) * yDirection;
      scrolled = this.setScrollTop(this.getScrollTop() + scaledDelta);
    }

    if (!verticalOnly && xDelta != null) {
      const scaledDelta = scaleMouseDragAutoscrollDelta(xDelta) * xDirection;
      scrolled = this.setScrollLeft(this.getScrollLeft() + scaledDelta);
    }

    if (scrolled) this.updateSync();
  }

  screenPositionForMouseEvent(event) {
    return this.screenPositionForPixelPosition(
      this.pixelPositionForMouseEvent(event)
    );
  }

  pixelPositionForMouseEvent({ clientX, clientY }) {
    const scrollContainerRect = this.refs.scrollContainer.getBoundingClientRect();
    clientX = Math.min(
      scrollContainerRect.right,
      Math.max(scrollContainerRect.left, clientX)
    );
    clientY = Math.min(
      scrollContainerRect.bottom,
      Math.max(scrollContainerRect.top, clientY)
    );
    const linesRect = this.refs.lineTiles.getBoundingClientRect();
    return {
      top: clientY - linesRect.top,
      left: clientX - linesRect.left
    };
  }

  didUpdateSelections() {
    this.pauseCursorBlinking();
    this.scheduleUpdate();
  }

  pauseCursorBlinking() {
    this.stopCursorBlinking();
    this.debouncedResumeCursorBlinking();
  }

  resumeCursorBlinking() {
    this.cursorsBlinkedOff = true;
    this.startCursorBlinking();
  }

  stopCursorBlinking() {
    if (this.cursorsBlinking) {
      this.cursorsBlinkedOff = false;
      this.cursorsBlinking = false;
      clearInterval(this.cursorBlinkIntervalHandle);
      this.cursorBlinkIntervalHandle = null;
      this.scheduleUpdate(true);
    }
  }

  startCursorBlinking() {
    if (!this.props.cursorBlink) {
      this.cursorsBlinkedOff = false;
      return
    }
    if (!this.cursorsBlinking) {
      this.cursorBlinkIntervalHandle = setInterval(() => {
        this.cursorsBlinkedOff = !this.cursorsBlinkedOff;
        this.scheduleUpdate(true);
      }, CURSOR_BLINK_PERIOD / 2);
      this.cursorsBlinking = true;
      this.scheduleUpdate(true);
    }
  }

  didRequestAutoscroll(autoscroll) {
    this.autoscrollVertically(autoscroll.screenRange, autoscroll.options)
    /* const coords = this.pixelPositionForScreenPosition(autoscroll.start)
     * this.setScrollTop(coords.top)
     * this.setScrollLeft(coords.left) */
    // console.log('AUTOSCROLL', autoscroll.screenRange, autoscroll.options)
    // this.pendingAutoscroll = autoscroll;
    // this.scheduleUpdate();

    /*
     * let { screenRange, options } = autoscroll;
     * this.autoscrollVertically(screenRange, options);
     * this.requestHorizontalMeasurement(
     *   screenRange.start.row,
     *   screenRange.start.column
     * );
     * this.requestHorizontalMeasurement(
     *   screenRange.end.row,
     *   screenRange.end.column
     * );
     */
  }

  flushPendingLogicalScrollPosition() {
    let changedScrollTop = false;
    if (this.pendingScrollTopRow > 0) {
      changedScrollTop = this.setScrollTopRow(this.pendingScrollTopRow, false);
      this.pendingScrollTopRow = null;
    }

    let changedScrollLeft = false;
    if (this.pendingScrollLeftColumn > 0) {
      changedScrollLeft = this.setScrollLeftColumn(
        this.pendingScrollLeftColumn,
        false
      );
      this.pendingScrollLeftColumn = null;
    }

    if (changedScrollTop || changedScrollLeft) {
      this.updateSync();
    }
  }


  autoscrollVertically(screenRange, options) {
    const screenRangeTop = this.pixelPositionAfterBlocksForRow(
      screenRange.start.row
    );
    const screenRangeBottom =
      this.pixelPositionAfterBlocksForRow(screenRange.end.row) +
      this.getLineHeight();
    const verticalScrollMargin = this.getVerticalAutoscrollMargin();

    let desiredScrollTop, desiredScrollBottom;
    if (options && options.center) {
      const desiredScrollCenter = (screenRangeTop + screenRangeBottom) / 2;
      if (
        desiredScrollCenter < this.getScrollTop() ||
        desiredScrollCenter > this.getScrollBottom()
      ) {
        desiredScrollTop =
          desiredScrollCenter - this.getScrollContainerClientHeight() / 2;
        desiredScrollBottom =
          desiredScrollCenter + this.getScrollContainerClientHeight() / 2;
      }
    } else {
      desiredScrollTop    = screenRangeTop - verticalScrollMargin;
      desiredScrollBottom = screenRangeBottom + verticalScrollMargin;
    }

    if (!options || options.reversed !== false) {
      if (desiredScrollBottom > this.getScrollBottom()) {
        this.setScrollBottom(desiredScrollBottom);
      }
      if (desiredScrollTop < this.getScrollTop()) {
        this.setScrollTop(desiredScrollTop);
      }
    } else {
      if (desiredScrollTop < this.getScrollTop()) {
        this.setScrollTop(desiredScrollTop);
      }
      if (desiredScrollBottom > this.getScrollBottom()) {
        this.setScrollBottom(desiredScrollBottom);
      }
    }

    return false;
  }

  autoscrollHorizontally(screenRange, options) {
    const horizontalScrollMargin = this.getHorizontalAutoscrollMargin();

    const gutterContainerWidth = this.getGutterContainerWidth();
    let left =
      this.pixelLeftForRowAndColumn(
        screenRange.start.row,
        screenRange.start.column
      ) + gutterContainerWidth;
    let right =
      this.pixelLeftForRowAndColumn(
        screenRange.end.row,
        screenRange.end.column
      ) + gutterContainerWidth;
    const desiredScrollLeft = Math.max(
      0,
      left - horizontalScrollMargin - gutterContainerWidth
    );
    const desiredScrollRight = Math.min(
      this.getScrollWidth(),
      right + horizontalScrollMargin
    );

    if (!options || options.reversed !== false) {
      if (desiredScrollRight > this.getScrollRight()) {
        this.setScrollRight(desiredScrollRight);
      }
      if (desiredScrollLeft < this.getScrollLeft()) {
        this.setScrollLeft(desiredScrollLeft);
      }
    } else {
      if (desiredScrollLeft < this.getScrollLeft()) {
        this.setScrollLeft(desiredScrollLeft);
      }
      if (desiredScrollRight > this.getScrollRight()) {
        this.setScrollRight(desiredScrollRight);
      }
    }
  }

  getVerticalAutoscrollMargin() {
    const maxMarginInLines = Math.floor(
      (this.getScrollContainerClientHeight() / this.getLineHeight() - 1) / 2
    );
    const marginInLines = Math.min(
      this.model.verticalScrollMargin,
      maxMarginInLines
    );
    return marginInLines * this.getLineHeight();
  }

  getHorizontalAutoscrollMargin() {
    const maxMarginInBaseCharacters = Math.floor(
      (this.getScrollContainerClientWidth() / this.getBaseCharacterWidth() -
        1) /
        2
    );
    const marginInBaseCharacters = Math.min(
      this.model.horizontalScrollMargin,
      maxMarginInBaseCharacters
    );
    return marginInBaseCharacters * this.getBaseCharacterWidth();
  }

  // This method is called at the beginning of a frame render to relay any
  // potential changes in the editor's width into the model before proceeding.
  updateModelSoftWrapColumn() {
    const { model } = this;
    const newEditorWidthInChars = this.getScrollContainerClientWidthInBaseCharacters();
    if (newEditorWidthInChars !== model.getEditorWidthInChars()) {
      this.suppressUpdates = true;

      const renderedStartRow = this.getRenderedStartRow();
      this.model.setEditorWidthInChars(newEditorWidthInChars);

      // Relaying a change in to the editor's client width may cause the
      // vertical scrollbar to appear or disappear, which causes the editor's
      // client width to change *again*. Make sure the display layer is fully
      // populated for the visible area before recalculating the editor's
      // width in characters. Then update the display layer *again* just in
      // case a change in scrollbar visibility causes lines to wrap
      // differently. We capture the renderedStartRow before resetting the
      // display layer because once it has been reset, we can't compute the
      // rendered start row accurately. 😥
      this.populateVisibleRowRange(renderedStartRow);
      this.model.setEditorWidthInChars(
        this.getScrollContainerClientWidthInBaseCharacters()
      );
      this.derivedDimensionsCache = {};

      this.suppressUpdates = false;
    }
  }

  // This method exists because it existed in the previous implementation and some
  // package tests relied on it
  measureDimensions() {
    this.measureCharacterDimensions();
    this.measureClientContainerHeight();
    this.measureClientContainerWidth();
    this.measureGutterDimensions();
    this.measureTextContainerDimensions();
    this.measureScrollbarDimensions();
    this.hasInitialMeasurements = true;

    const {
      textContainerWidth,
      baseCharacterWidth,
      horizontalPadding,
    } = this.measurements

    const usableTextWidth = textContainerWidth - horizontalPadding
    const editorWidthInChars = Math.floor(usableTextWidth / baseCharacterWidth) - 1

    this.model.update({
      width: usableTextWidth,
      editorWidthInChars,
    })
    // console.log('TODO: handle this')
    /* console.log({
     *   width: usableTextWidth,
     *   editorWidthInChars,
     * }) */
  }

  measureCharacterDimensions() {
    this.fontSize   = DEFAULT_FONT_SIZE
    this.fontFamily = DEFAULT_FONT_FAMILY
    this.font = Font.parse(`${this.fontFamily} ${this.fontSize}px`)

    this.measurements.lineHeight = this.font.charHeight;
    this.measurements.baseCharacterWidth = this.font.charWidth;
    this.measurements.doubleWidthCharacterWidth = this.font.doubleWidth;
    this.measurements.halfWidthCharacterWidth = this.font.halfWidth;
    this.measurements.koreanCharacterWidth = this.font.koreanWidth;

    this.model.setLineHeightInPixels(this.measurements.lineHeight);
    this.model.setDefaultCharWidth(
      this.measurements.baseCharacterWidth,
      this.measurements.doubleWidthCharacterWidth,
      this.measurements.halfWidthCharacterWidth,
      this.measurements.koreanCharacterWidth
    );
    this.lineTopIndex.setDefaultLineHeight(this.measurements.lineHeight);
  }

  measureGutterDimensions() {
    let dimensionsChanged = false;

    if (this.props.mini) {
      dimensionsChanged = this.measurements.lineNumberGutterWidth !== 0
                       || this.measurements.gutterContainerWidth  !== 0;
      this.measurements.lineNumberGutterWidth = 0;
      this.measurements.gutterContainerWidth = 0;
      return dimensionsChanged;
    }

    const lineNumberGutterWidth = this.measurements.baseCharacterWidth * (this.lineNumbersToRender.maxDigits + 2)
    if (lineNumberGutterWidth !== this.measurements.lineNumberGutterWidth) {
      dimensionsChanged = true;
      this.measurements.lineNumberGutterWidth = lineNumberGutterWidth;
    }

    const gutterContainerWidth = lineNumberGutterWidth;
    if (gutterContainerWidth !== this.measurements.gutterContainerWidth) {
      dimensionsChanged = true;
      this.measurements.gutterContainerWidth = gutterContainerWidth;
    }

    return dimensionsChanged;
  }

  measureClientContainerHeight() {
    const clientContainerHeight = this.getAllocatedHeight();
    if (clientContainerHeight !== this.measurements.clientContainerHeight) {
      this.measurements.clientContainerHeight = clientContainerHeight;
      return true;
    } else {
      return false;
    }
  }

  measureClientContainerWidth() {
    const clientContainerWidth = this.getAllocatedWidth();
    if (clientContainerWidth !== this.measurements.clientContainerWidth) {
      this.measurements.clientContainerWidth = clientContainerWidth;
      return true;
    } else {
      return false;
    }
  }

  measureTextContainerDimensions() {
    const { measurements } = this
    measurements.textContainerWidth  = measurements.clientContainerWidth - measurements.gutterContainerWidth
    measurements.textContainerHeight = measurements.clientContainerHeight
  }

  measureScrollbarDimensions() {
    this.measurements.verticalScrollbarWidth = 0;
    this.measurements.horizontalScrollbarHeight = 0;
  }

  measureLongestLineWidth() {
    if (this.longestLineToMeasure) {
      const [width] = Font.measure(
        this.font.description,
        this.longestLineToMeasure.lineText
      )
      this.measurements.longestLineWidth = width
      this.longestLineToMeasure = null;
    }
  }

  requestLineToMeasure(row, screenLine) {
    this.linesToMeasure.set(row, screenLine);
  }

  requestHorizontalMeasurement(row, column) {
    if (column === 0) return;

    const screenLine = this.model.screenLineForScreenRow(row);
    if (screenLine) {
      this.requestLineToMeasure(row, screenLine);

      let columns = this.horizontalPositionsToMeasure.get(row);
      if (columns == null) {
        columns = [];
        this.horizontalPositionsToMeasure.set(row, columns);
      }
      columns.push(column);
    }
  }

  measureHorizontalPositions() {
    this.horizontalPositionsToMeasure.forEach((columnsToMeasure, row) => {
      columnsToMeasure.sort((a, b) => a - b);

      const screenLine = this.renderedScreenLineForRow(row);
      const lineComponent = this.lineComponentsByScreenLineId.get(
        screenLine.id
      );

      if (!lineComponent) {
        // FIXME: this is not required because we don't use lineComponent is measurements
        // for now, but we should either clean it or re-enable it when we do horizontal
        // measurements differently.
        // const error = new Error(
        //   'Requested measurement of a line component that is not currently rendered'
        // );
        // error.metadata = {
        //   row,
        //   columnsToMeasure,
        //   renderedScreenLineIds: this.renderedScreenLines.map(line => line.id),
        //   extraRenderedScreenLineIds: Array.from(
        //     this.extraRenderedScreenLines.keys()
        //   ),
        //   lineComponentScreenLineIds: Array.from(
        //     this.lineComponentsByScreenLineId.keys()
        //   ),
        //   renderedStartRow: this.getRenderedStartRow(),
        //   renderedEndRow: this.getRenderedEndRow(),
        //   requestedScreenLineId: screenLine.id
        // };
        // throw error;
      }

      let positionsForLine = this.horizontalPixelPositionsByScreenLineId.get(
        screenLine.id
      );
      if (positionsForLine == null) {
        positionsForLine = new Map();
        this.horizontalPixelPositionsByScreenLineId.set(
          screenLine.id,
          positionsForLine
        );
      }

      this.measureHorizontalPositionsOnLine(
        lineComponent,
        columnsToMeasure,
        positionsForLine
      );
    });
    this.horizontalPositionsToMeasure.clear();
  }

  measureHorizontalPositionsOnLine(
    lineComponent,
    columnsToMeasure,
    positions
  ) {
    // FIXME: handle this correctly (textNodes gone)

    for (let i = 0; i < columnsToMeasure.length; i++) {
      const column = columnsToMeasure[i]
      const x = this.measurements.baseCharacterWidth * column
      positions.set(column, x)
    }

    /* let lineNodeClientLeft = -1;
     * let textNodeStartColumn = 0;
     * let textNodesIndex = 0;
     * let lastTextNodeRight = null;
     *
     * const text = lineComponent.getText()
     *
     * // eslint-disable-next-line no-labels
     * columnLoop: for (
     *   let columnsIndex = 0;
     *   columnsIndex < columnsToMeasure.length;
     *   columnsIndex++
     * ) {
     *   const nextColumnToMeasure = columnsToMeasure[columnsIndex];
     *   while (textNodesIndex < textNodes.length) {
     *     if (nextColumnToMeasure === 0) {
     *       positions.set(0, 0);
     *       continue columnLoop; // eslint-disable-line no-labels
     *     }
     *
     *     if (positions.has(nextColumnToMeasure)) continue columnLoop; // eslint-disable-line no-labels
     *     const textNode = textNodes[textNodesIndex];
     *     const textNodeEndColumn =
     *       textNodeStartColumn + textNode.textContent.length;
     *
     *     if (nextColumnToMeasure < textNodeEndColumn) {
     *       let clientPixelPosition;
     *       if (nextColumnToMeasure === textNodeStartColumn) {
     *         // clientPixelPosition = clientRectForRange(textNode, 0, 1).left;
     *         clientPixelPosition =
     *           Font.measure(this.font.description, text.slice(0, textNodeStartColumn));
     *       } else {
     *         // clientPixelPosition = clientRectForRange(
     *         //   textNode,
     *         //   0,
     *         //   nextColumnToMeasure - textNodeStartColumn
     *         // ).right;
     *         clientPixelPosition =
     *           Font.measure(this.font.description, text.slice(0, nextColumnToMeasure));
     *       }
     *
     *       if (lineNodeClientLeft === -1) {
     *         // lineNodeClientLeft = lineNode.getBoundingClientRect().left;
     *         lineNodeClientLeft = 0;
     *       }
     *
     *       positions.set(
     *         nextColumnToMeasure,
     *         Math.round(clientPixelPosition - lineNodeClientLeft)
     *       );
     *       continue columnLoop; // eslint-disable-line no-labels
     *     } else {
     *       textNodesIndex++;
     *       textNodeStartColumn = textNodeEndColumn;
     *     }
     *   }
     *
     *   if (lastTextNodeRight == null) {
     *     const lastTextNode = textNodes[textNodes.length - 1];
     *     lastTextNodeRight = clientRectForRange(
     *       lastTextNode,
     *       0,
     *       lastTextNode.textContent.length
     *     ).right;
     *   }
     *
     *   if (lineNodeClientLeft === -1) {
     *     // lineNodeClientLeft = lineNode.getBoundingClientRect().left;
     *     lineNodeClientLeft = 0;
     *   }
     *
     *   positions.set(
     *     nextColumnToMeasure,
     *     Math.round(lastTextNodeRight - lineNodeClientLeft)
     *   );
     * } */
  }

  rowForPixelPosition(pixelPosition) {
    return Math.max(0, this.lineTopIndex.rowForPixelPosition(pixelPosition));
  }

  heightForBlockDecorationsBeforeRow(row) {
    return (
      this.pixelPositionAfterBlocksForRow(row) -
      this.pixelPositionBeforeBlocksForRow(row)
    );
  }

  heightForBlockDecorationsAfterRow(row) {
    const currentRowBottom =
      this.pixelPositionAfterBlocksForRow(row) + this.getLineHeight();
    const nextRowTop = this.pixelPositionBeforeBlocksForRow(row + 1);
    return nextRowTop - currentRowBottom;
  }

  pixelPositionBeforeBlocksForRow(row) {
    return this.lineTopIndex.pixelPositionBeforeBlocksForRow(row);
  }

  pixelPositionAfterBlocksForRow(row) {
    return this.lineTopIndex.pixelPositionAfterBlocksForRow(row);
  }

  pixelLeftForRowAndColumn(row, column) {
    if (column === 0) return 0;
    const screenLine = this.renderedScreenLineForRow(row);
    if (screenLine) {
      const horizontalPositionsByColumn = this.horizontalPixelPositionsByScreenLineId.get(
        screenLine.id
      );
      if (horizontalPositionsByColumn) {
        const left = horizontalPositionsByColumn.get(column);
        if (typeof left === 'number')
          return left;
      }
    }
    // FIXME: this should not happen
    return this.measurements.baseCharacterWidth * column;
  }

  screenPositionForPixelPosition({ top, left }) {
    const { model } = this;

    const row = Math.min(
      this.rowForPixelPosition(top),
      model.getApproximateScreenLineCount() - 1
    );

    let screenLine = this.renderedScreenLineForRow(row);
    if (!screenLine) {
      this.requestLineToMeasure(row, model.screenLineForScreenRow(row));
      this.updateSyncBeforeMeasuringContent();
      this.measureContentDuringUpdateSync();
      screenLine = this.renderedScreenLineForRow(row);
    }

    // FIXME: handle column correctly, see commented code
    const column = Math.round(left / this.measurements.baseCharacterWidth)
    return new Point(row, column)

    // const linesClientLeft = this.refs.lineTiles.getBoundingClientRect().left;
    // const targetClientLeft = linesClientLeft + Math.max(0, left);
    // const lineComponent = this.lineComponentsByScreenLineId.get(screenLine.id);
    // const { textNodes } = lineComponent;

    // let containingTextNodeIndex;
    // {
    //   let low = 0;
    //   let high = textNodes.length - 1;
    //   while (low <= high) {
    //     const mid = low + ((high - low) >> 1);
    //     const textNode = textNodes[mid];
    //     const textNodeRect = clientRectForRange(textNode, 0, textNode.length);

    //     if (targetClientLeft < textNodeRect.left) {
    //       high = mid - 1;
    //       containingTextNodeIndex = Math.max(0, mid - 1);
    //     } else if (targetClientLeft > textNodeRect.right) {
    //       low = mid + 1;
    //       containingTextNodeIndex = Math.min(textNodes.length - 1, mid + 1);
    //     } else {
    //       containingTextNodeIndex = mid;
    //       break;
    //     }
    //   }
    // }
    // const containingTextNode = textNodes[containingTextNodeIndex];
    // let characterIndex = 0;
    // {
    //   let low = 0;
    //   let high = containingTextNode.length - 1;
    //   while (low <= high) {
    //     const charIndex = low + ((high - low) >> 1);
    //     const nextCharIndex = isPairedCharacter(
    //       containingTextNode.textContent,
    //       charIndex
    //     )
    //       ? charIndex + 2
    //       : charIndex + 1;

    //     const rangeRect = clientRectForRange(
    //       containingTextNode,
    //       charIndex,
    //       nextCharIndex
    //     );
    //     if (targetClientLeft < rangeRect.left) {
    //       high = charIndex - 1;
    //       characterIndex = Math.max(0, charIndex - 1);
    //     } else if (targetClientLeft > rangeRect.right) {
    //       low = nextCharIndex;
    //       characterIndex = Math.min(
    //         containingTextNode.textContent.length,
    //         nextCharIndex
    //       );
    //     } else {
    //       if (targetClientLeft <= (rangeRect.left + rangeRect.right) / 2) {
    //         characterIndex = charIndex;
    //       } else {
    //         characterIndex = nextCharIndex;
    //       }
    //       break;
    //     }
    //   }
    // }

    // let textNodeStartColumn = 0;
    // for (let i = 0; i < containingTextNodeIndex; i++) {
    //   textNodeStartColumn = textNodeStartColumn + textNodes[i].length;
    // }
    // const column = textNodeStartColumn + characterIndex;

    // return Point(row, column);
  }

  didResetDisplayLayer() {
    this.spliceLineTopIndex(0, Infinity, Infinity);
    this.scheduleUpdate();
  }

  didChangeDisplayLayer(changes) {
    for (let i = 0; i < changes.length; i++) {
      const { oldRange, newRange } = changes[i];
      this.spliceLineTopIndex(
        newRange.start.row,
        oldRange.end.row - oldRange.start.row,
        newRange.end.row - newRange.start.row
      );
    }

    this.scheduleUpdate();
  }

  didChangeSelectionRange() {
    // FIXME: implement setting selection on linux
    // const { model } = this;
    //
    // if (this.getPlatform() === 'linux') {
    //   if (this.selectionClipboardImmediateId) {
    //     clearImmediate(this.selectionClipboardImmediateId);
    //   }

    //   this.selectionClipboardImmediateId = setImmediate(() => {
    //     this.selectionClipboardImmediateId = null;

    //     if (model.isDestroyed()) return;

    //     const selectedText = model.getSelectedText();
    //     if (selectedText) {
    //       // This uses ipcRenderer.send instead of clipboard.writeText because
    //       // clipboard.writeText is a sync ipcRenderer call on Linux and that
    //       // will slow down selections.
    //       electron.ipcRenderer.send(
    //         'write-text-to-selection-clipboard',
    //         selectedText
    //       );
    //     }
    //   });
    // }
  }

  observeBlockDecorations() {
    const { model } = this;
    const decorations = model.getDecorations({ type: 'block' });
    for (let i = 0; i < decorations.length; i++) {
      this.addBlockDecoration(decorations[i]);
    }
  }

  addBlockDecoration(decoration, subscribeToChanges = true) {
    const marker = decoration.getMarker();
    const { item, position } = decoration.getProperties();
    const element = TextEditor.viewForItem(item);

    if (marker.isValid()) {
      const row = marker.getHeadScreenPosition().row;
      this.lineTopIndex.insertBlock(decoration, row, 0, position === 'after');
      this.blockDecorationsToMeasure.add(decoration);
      this.blockDecorationsByElement.set(element, decoration);

      this.scheduleUpdate();
    }

    if (subscribeToChanges) {
      let wasValid = marker.isValid();

      const didUpdateDisposable = marker.bufferMarker.onDidChange(
        ({ textChanged }) => {
          const isValid = marker.isValid();
          if (wasValid && !isValid) {
            wasValid = false;
            this.blockDecorationsToMeasure.delete(decoration);
            this.heightsByBlockDecoration.delete(decoration);
            this.blockDecorationsByElement.delete(element);
            this.lineTopIndex.removeBlock(decoration);
            this.scheduleUpdate();
          } else if (!wasValid && isValid) {
            wasValid = true;
            this.addBlockDecoration(decoration, false);
          } else if (isValid && !textChanged) {
            this.lineTopIndex.moveBlock(
              decoration,
              marker.getHeadScreenPosition().row
            );
            this.scheduleUpdate();
          }
        }
      );

      const didDestroyDisposable = decoration.onDidDestroy(() => {
        didUpdateDisposable.dispose();
        didDestroyDisposable.dispose();

        if (wasValid) {
          wasValid = false;
          this.blockDecorationsToMeasure.delete(decoration);
          this.heightsByBlockDecoration.delete(decoration);
          this.blockDecorationsByElement.delete(element);
          this.lineTopIndex.removeBlock(decoration);
          this.scheduleUpdate();
        }
      });
    }
  }

  didResizeBlockDecorations(entries) {
    if (!this._visible) return;

    for (let i = 0; i < entries.length; i++) {
      const { target, contentRect } = entries[i];
      const decoration = this.blockDecorationsByElement.get(target);
      const previousHeight = this.heightsByBlockDecoration.get(decoration);
      if (
        this.element.contains(target) &&
        contentRect.height !== previousHeight
      ) {
        this.invalidateBlockDecorationDimensions(decoration);
      }
    }
  }

  invalidateBlockDecorationDimensions(decoration) {
    this.blockDecorationsToMeasure.add(decoration);
    this.scheduleUpdate();
  }

  spliceLineTopIndex(startRow, oldExtent, newExtent) {
    const invalidatedBlockDecorations = this.lineTopIndex.splice(
      startRow,
      oldExtent,
      newExtent
    );
    invalidatedBlockDecorations.forEach(decoration => {
      const newPosition = decoration.getMarker().getHeadScreenPosition();
      this.lineTopIndex.moveBlock(decoration, newPosition.row);
    });
  }

  isVisible() {
    return true
  }

  getWindowInnerHeight() {
    throw new Error('unimplemented')
    return window.innerHeight;
  }

  getWindowInnerWidth() {
    throw new Error('unimplemented')
    return window.innerWidth;
  }

  getLineHeight() {
    return this.measurements.lineHeight;
  }

  getBaseCharacterWidth() {
    return this.measurements.baseCharacterWidth;
  }

  getLongestLineWidth() {
    return this.measurements.longestLineWidth;
  }

  getClientContainerHeight() {
    return this.measurements.clientContainerHeight;
  }

  getClientContainerWidth() {
    return this.measurements.clientContainerWidth;
  }

  getScrollContainerWidth() {
    /* if (this.model.getAutoWidth()) {
     *   return this.getScrollWidth();
     * } else {
     *   return this.getClientContainerWidth() - this.getGutterContainerWidth();
     * } */
    return this.getClientContainerWidth() - this.getGutterContainerWidth();
  }

  getScrollContainerHeight() {
    /* if (this.model.getAutoHeight()) {
     *   return this.getScrollHeight() + this.getHorizontalScrollbarHeight();
     * } else {
     *   return this.getClientContainerHeight();
     * } */
    return this.getClientContainerHeight();
  }

  getScrollContainerClientWidth() {
    return this.getScrollContainerWidth() - this.getVerticalScrollbarWidth();
  }

  getScrollContainerClientHeight() {
    return (
      this.getScrollContainerHeight() - this.getHorizontalScrollbarHeight()
    );
  }

  canScrollVertically() {
    const { model } = this;
    if (model.isMini()) return false;
    if (model.getAutoHeight()) return false;
    return this.getContentHeight() > this.getScrollContainerClientHeight();
  }

  canScrollHorizontally() {
    const { model } = this;
    if (model.isMini()) return false;
    if (model.getAutoWidth()) return false;
    if (model.isSoftWrapped()) return false;
    return this.getContentWidth() > this.getScrollContainerClientWidth();
  }

  getScrollHeight() {
    if (this.model.getScrollPastEnd()) {
      return (
        this.getContentHeight() +
        Math.max(
          3 * this.getLineHeight(),
          this.getScrollContainerClientHeight() - 3 * this.getLineHeight()
        )
      );
    } else if (this.model.getAutoHeight()) {
      return this.getContentHeight();
    } else {
      return Math.max(
        this.getContentHeight(),
        this.getScrollContainerClientHeight()
      );
    }
  }

  getScrollWidth() {
    const { model } = this;

    if (model.isSoftWrapped()) {
      return this.getScrollContainerClientWidth();
    } else if (model.getAutoWidth()) {
      return this.getContentWidth();
    } else {
      return Math.max(
        this.getContentWidth(),
        this.getScrollContainerClientWidth()
      );
    }
  }

  getContentHeight() {
    return this.pixelPositionAfterBlocksForRow(
      this.model.getApproximateScreenLineCount()
    );
  }

  getContentWidth() {
    return Math.ceil(this.getLongestLineWidth() + this.getBaseCharacterWidth());
  }

  getScrollContainerClientWidthInBaseCharacters() {
    return Math.floor(
      this.getScrollContainerClientWidth() / this.getBaseCharacterWidth()
    );
  }

  getGutterContainerWidth() {
    return this.measurements.gutterContainerWidth;
  }

  getLineNumberGutterWidth() {
    return this.measurements.lineNumberGutterWidth;
  }

  getVerticalScrollbarWidth() {
    return 0
  }

  getHorizontalScrollbarHeight() {
    return 0
  }

  getRowsPerTile() {
    return this.rowsPerTile || DEFAULT_ROWS_PER_TILE;
  }

  tileStartRowForRow(row) {
    return row - (row % this.getRowsPerTile());
  }

  getRenderedStartRow() {
    if (this.derivedDimensionsCache.renderedStartRow == null) {
      this.derivedDimensionsCache.renderedStartRow = this.tileStartRowForRow(
        this.getFirstVisibleRow()
      );
    }
    return this.derivedDimensionsCache.renderedStartRow; 
  }

  getRenderedEndRow() {
    if (this.derivedDimensionsCache.renderedEndRow == null) {
      this.derivedDimensionsCache.renderedEndRow = Math.min(
        this.model.getApproximateScreenLineCount(),
        this.getRenderedStartRow() +
          this.getVisibleTileCount() * this.getRowsPerTile()
      ); 
    }

    return this.derivedDimensionsCache.renderedEndRow;
  }

  getRenderedRowCount() {
    if (this.derivedDimensionsCache.renderedRowCount == null) {
      this.derivedDimensionsCache.renderedRowCount = Math.max(
        0,
        this.getRenderedEndRow() - this.getRenderedStartRow()
      );
    }

    return this.derivedDimensionsCache.renderedRowCount;
  }

  getRenderedTileCount() {
    if (this.derivedDimensionsCache.renderedTileCount == null) {
      this.derivedDimensionsCache.renderedTileCount = Math.ceil(
        this.getRenderedRowCount() / this.getRowsPerTile()
      );
    }

    return this.derivedDimensionsCache.renderedTileCount;
  }


  getFirstVisibleRow() {
    if (this.derivedDimensionsCache.firstVisibleRow == null) {
      this.derivedDimensionsCache.firstVisibleRow = this.rowForPixelPosition(
        this.getScrollTop()
      );
    }

    return this.derivedDimensionsCache.firstVisibleRow;
  }

  getLastVisibleRow() {
    if (this.derivedDimensionsCache.lastVisibleRow == null) {
      this.derivedDimensionsCache.lastVisibleRow =
        this.rowForPixelPosition(this.getScrollBottom());
    }

    return this.derivedDimensionsCache.lastVisibleRow;
  }

  // We may render more tiles than needed if some contain block decorations,
  // but keeping this calculation simple ensures the number of tiles remains
  // fixed for a given editor height, which eliminates situations where a
  // tile is repeatedly added and removed during scrolling in certain
  // combinations of editor height and line height.
  getVisibleTileCount() {
    if (this.derivedDimensionsCache.visibleTileCount == null) {
      const editorHeightInTiles =
        this.getScrollContainerHeight() /
        this.getLineHeight() /
        this.getRowsPerTile();
      this.derivedDimensionsCache.visibleTileCount =
        Math.ceil(editorHeightInTiles) + 1;
    }
    return this.derivedDimensionsCache.visibleTileCount;
  }

  getFirstVisibleColumn() {
    return Math.floor(this.getScrollLeft() / this.getBaseCharacterWidth());
  }

  getScrollTop() {
    return this.textWindow.getVadjustment().getValue()
    // this.scrollTop = Math.min(this.getMaxScrollTop(), this.scrollTop);
    // return this.scrollTop;
  }

  setScrollTop(scrollTop) {
    if (Number.isNaN(scrollTop) || scrollTop == null) return false;

    scrollTop = roundToPhysicalPixelBoundary(
      Math.max(0, Math.min(this.getMaxScrollTop(), scrollTop))
    );
    if (scrollTop !== this.getScrollTop()) {
      this.derivedDimensionsCache = {};
      this.scrollTopPending = true;
      this.textWindow.scrollTo(scrollTop, true)
      this.emitter.emit('did-change-scroll-top', scrollTop);
      return true;
    } else {
      return false;
    }
  }

  getMaxScrollTop() {
    return Math.round(
      Math.max(
        0,
        this.getScrollHeight() - this.getScrollContainerClientHeight()
      )
    );
  }

  getScrollBottom() {
    return this.getScrollTop() + this.getScrollContainerClientHeight();
  }

  setScrollBottom(scrollBottom) {
    return this.setScrollTop(
      scrollBottom - this.getScrollContainerClientHeight()
    );
  }

  getScrollLeft() {
    return this.textWindow.getHadjustment().getValue()
  }

  setScrollLeft(scrollLeft) {
    if (Number.isNaN(scrollLeft) || scrollLeft == null) return false;

    scrollLeft = roundToPhysicalPixelBoundary(
      Math.max(0, Math.min(this.getMaxScrollLeft(), scrollLeft))
    );
    if (scrollLeft !== this.getScrollLeft()) {
      this.scrollLeftPending = true;
      this.textWindow.scrollTo(scrollTop, false)
      this.emitter.emit('did-change-scroll-left', scrollLeft);
      return true;
    } else {
      return false;
    }
  }

  getMaxScrollLeft() {
    return Math.round(
      Math.max(0, this.getScrollWidth() - this.getScrollContainerClientWidth())
    );
  }

  getScrollRight() {
    return this.getScrollLeft() + this.getScrollContainerClientWidth();
  }

  setScrollRight(scrollRight) {
    return this.setScrollLeft(
      scrollRight - this.getScrollContainerClientWidth()
    );
  }

  setScrollTopRow(scrollTopRow, scheduleUpdate = true) {
    if (this.hasInitialMeasurements) {
      const didScroll = this.setScrollTop(
        this.pixelPositionBeforeBlocksForRow(scrollTopRow)
      );
      if (didScroll && scheduleUpdate) {
        this.scheduleUpdate();
      }
      return didScroll;
    } else {
      this.pendingScrollTopRow = scrollTopRow;
      return false;
    }
  }

  getScrollTopRow() {
    if (this.hasInitialMeasurements) {
      return this.rowForPixelPosition(this.getScrollTop());
    } else {
      return this.pendingScrollTopRow || 0;
    }
  }

  setScrollLeftColumn(scrollLeftColumn, scheduleUpdate = true) {
    if (this.hasInitialMeasurements && this.getLongestLineWidth() != null) {
      const didScroll = this.setScrollLeft(
        scrollLeftColumn * this.getBaseCharacterWidth()
      );
      if (didScroll && scheduleUpdate) {
        this.scheduleUpdate();
      }
      return didScroll;
    } else {
      this.pendingScrollLeftColumn = scrollLeftColumn;
      return false;
    }
  }

  getScrollLeftColumn() {
    if (this.hasInitialMeasurements && this.getLongestLineWidth() != null) {
      return Math.round(this.getScrollLeft() / this.getBaseCharacterWidth());
    } else {
      return this.pendingScrollLeftColumn || 0;
    }
  }

  // Ensure the spatial index is populated with rows that are currently visible
  populateVisibleRowRange() {
    const { model } = this;
    const previousScreenLineCount = model.getApproximateScreenLineCount();

    const renderedEndRow = model.getScreenLineCount()

    model.displayLayer.populateSpatialIndexIfNeeded(
      Infinity,
      renderedEndRow
    );

    // If the approximate screen line count changes, previously-cached derived
    // dimensions could now be out of date.
    if (model.getApproximateScreenLineCount() !== previousScreenLineCount) {
      this.derivedDimensionsCache = {};
    }
  }

  populateVisibleTiles() {
    const startRow = this.getRenderedStartRow();
    const endRow = this.getRenderedEndRow();
    const freeTileIds = [];
    for (let i = 0; i < this.renderedTileStartRows.length; i++) {
      const tileStartRow = this.renderedTileStartRows[i];
      if (tileStartRow < startRow || tileStartRow >= endRow) {
        const tileId = this.idsByTileStartRow.get(tileStartRow);
        freeTileIds.push(tileId);
        this.tilesById.get(tileId).destroy()
        this.tilesById.delete(tileId)
        this.idsByTileStartRow.delete(tileStartRow);
      }
    }

    const rowsPerTile = this.getRowsPerTile();
    this.renderedTileStartRows.length = this.getRenderedTileCount();
    for (
      let tileStartRow = startRow, i = 0;
      tileStartRow < endRow;
      tileStartRow = tileStartRow + rowsPerTile, i++
    ) {
      this.renderedTileStartRows[i] = tileStartRow;
      if (!this.idsByTileStartRow.has(tileStartRow)) {
        if (freeTileIds.length > 0) {
          this.idsByTileStartRow.set(tileStartRow, freeTileIds.shift());
        } else {
          this.idsByTileStartRow.set(tileStartRow, this.nextTileId++);
        }
      }
    }

    this.renderedTileStartRows.sort(
      (a, b) => this.idsByTileStartRow.get(a) - this.idsByTileStartRow.get(b)
    );
  }

  getNextUpdatePromise() {
    if (!this.nextUpdatePromise) {
      this.nextUpdatePromise = new Promise(resolve => {
        this.resolveNextUpdatePromise = () => {
          this.nextUpdatePromise = null;
          this.resolveNextUpdatePromise = null;
          resolve();
        };
      });
    }
    return this.nextUpdatePromise;
  }

  setInputEnabled(inputEnabled) {
    this.model.update({ keyboardInputEnabled: inputEnabled });
  }

  isInputEnabled() {
    return (
      !this.model.isReadOnly() &&
      this.model.isKeyboardInputEnabled()
    );
  }

  getPlatform() {
    return process.platform;
  }

  translateCoordinates(dest, srcX, srcY) {
    const [_, x, y] = this.textWindow.translateCoordinates(
      dest,
      srcX,
      srcY
    )
    return [x, y]
  }
}

/*
 * Subcomponents of TextEditor
 */

class LinesTileComponent extends Gtk.Widget {
  constructor(props) {
    super()
    this.props = props;
    this.focusable = false
    this.lineComponents = []
    this.styleContext = this.getStyleContext()
    this.createLines();
    this.updateBlockDecorations({}, props);
    this.props.parent.put(this, 0, this.props.top)
  }

  update(newProps) {
    if (this.shouldUpdate(newProps)) {
      const oldProps = this.props;
      this.props = newProps;
      if (!newProps.measuredContent) {
        this.updateLines(oldProps, newProps);
        this.updateBlockDecorations(oldProps, newProps);
      }
      if (oldProps.top !== newProps.top) {
        this.props.parent.move(tile, 0, top)
      }
    }
  }

  destroy() {
    for (let i = 0; i < this.lineComponents.length; i++) {
      this.lineComponents[i].destroy();
    }
    this.lineComponents.length = 0;
    this.props.blockDecorations?.forEach(decorations => {
      decorations.forEach(decoration => {
        decoration.item.getParent()?.remove(decoration.item)
      })
    })
    this.getParent().remove(this)
  }

  createLines() {
    const {
      height,
      width,
      top,
      font,
      measurements,
      screenLines,
      tileStartRow,
      lineDecorations,
      textDecorations,
      highlightDecorations,
      displayLayer,
      lineComponentsByScreenLineId,
    } = this.props;

    this.y = top

    this.setSizeRequest(width, height)

    this.textSurface = new Cairo.ImageSurface(Cairo.Format.ARGB32, width, height)
    this.textContext = new Cairo.Context(this.textSurface)
    this.textLayout = PangoCairo.createLayout(this.textContext)
    this.textLayout.setAlignment(Pango.Alignment.LEFT)
    this.textLayout.setFontDescription(font.description)

    for (let i = 0, length = screenLines.length; i < length; i++) {
      const component = new LineComponent({
        tile: this,
        width,
        height,
        measurements,
        index: i,
        screenLine: screenLines[i],
        screenRow: tileStartRow + i,
        lineDecoration: lineDecorations[i],
        textDecorations: textDecorations[i],
        highlightDecorations: highlightDecorations[i],
        displayLayer,
        lineComponentsByScreenLineId
      });
      this.lineComponents.push(component)
    }
  }

  updateLines(oldProps, newProps) {
    const {
      height,
      width,
      measurements,
      screenLines,
      tileStartRow,
      lineDecorations,
      textDecorations,
      highlightDecorations,
      displayLayer,
      lineComponentsByScreenLineId,
    } = newProps;

    const oldScreenLines = oldProps.screenLines;
    const newScreenLines = screenLines;
    const oldScreenLinesEndIndex = oldScreenLines.length;
    const newScreenLinesEndIndex = newScreenLines.length;
    let oldScreenLineIndex = 0;
    let newScreenLineIndex = 0;
    let lineComponentIndex = 0;

    while (
      oldScreenLineIndex < oldScreenLinesEndIndex ||
      newScreenLineIndex < newScreenLinesEndIndex
    ) {
      const oldScreenLine = oldScreenLines[oldScreenLineIndex];
      const newScreenLine = newScreenLines[newScreenLineIndex];

      if (oldScreenLineIndex >= oldScreenLinesEndIndex) {
        const newScreenLineComponent = new LineComponent({
          tile: this,
          width,
          height,
          measurements,
          index: newScreenLineIndex,
          screenLine: newScreenLine,
          screenRow: tileStartRow + newScreenLineIndex,
          lineDecoration: lineDecorations[newScreenLineIndex],
          textDecorations: textDecorations[newScreenLineIndex],
          highlightDecorations: highlightDecorations[newScreenLineIndex],
          displayLayer,
          lineComponentsByScreenLineId
        });

        this.lineComponents.push(newScreenLineComponent);

        newScreenLineIndex++;
        lineComponentIndex++;
      } else if (newScreenLineIndex >= newScreenLinesEndIndex) {
        this.lineComponents[lineComponentIndex].destroy();
        this.lineComponents.splice(lineComponentIndex, 1);

        oldScreenLineIndex++;
      } else if (oldScreenLine === newScreenLine) {
        const lineComponent = this.lineComponents[lineComponentIndex];
        lineComponent.update({
          index: newScreenLineIndex,
          screenRow: tileStartRow + newScreenLineIndex,
          lineDecoration: lineDecorations[newScreenLineIndex],
          textDecorations: textDecorations[newScreenLineIndex]
        });

        oldScreenLineIndex++;
        newScreenLineIndex++;
        lineComponentIndex++;
      } else {
        const oldScreenLineIndexInNewScreenLines = newScreenLines.indexOf(
          oldScreenLine
        );
        const newScreenLineIndexInOldScreenLines = oldScreenLines.indexOf(
          newScreenLine
        );
        if (
          newScreenLineIndex < oldScreenLineIndexInNewScreenLines &&
          oldScreenLineIndexInNewScreenLines < newScreenLinesEndIndex
        ) {
          const newScreenLineComponents = [];
          while (newScreenLineIndex < oldScreenLineIndexInNewScreenLines) {
            // eslint-disable-next-line no-redeclare
            const newScreenLineComponent = new LineComponent({
              tile: this,
              width,
              height,
              measurements,
              index: newScreenLineIndex,
              screenLine: newScreenLine,
              screenRow: tileStartRow + newScreenLineIndex,
              lineDecoration: lineDecorations[newScreenLineIndex],
              textDecorations: textDecorations[newScreenLineIndex],
              highlightDecorations: highlightDecorations[newScreenLineIndex],
              displayLayer,
              lineComponentsByScreenLineId
            });
            // FIXME: delete this
            // this.element.insertBefore(
            //   newScreenLineComponent.element,
            //   this.getFirstElementForScreenLine(oldProps, oldScreenLine)
            // );
            newScreenLineComponents.push(newScreenLineComponent);

            newScreenLineIndex++;
          }

          this.lineComponents.splice(
            lineComponentIndex,
            0,
            ...newScreenLineComponents
          );
          lineComponentIndex =
            lineComponentIndex + newScreenLineComponents.length;
        } else if (
          oldScreenLineIndex < newScreenLineIndexInOldScreenLines &&
          newScreenLineIndexInOldScreenLines < oldScreenLinesEndIndex
        ) {
          while (oldScreenLineIndex < newScreenLineIndexInOldScreenLines) {
            this.lineComponents[lineComponentIndex].destroy();
            this.lineComponents.splice(lineComponentIndex, 1);

            oldScreenLineIndex++;
          }
        } else {
          const oldScreenLineComponent = this.lineComponents[lineComponentIndex];
          // eslint-disable-next-line no-redeclare
          const newScreenLineComponent = new LineComponent({
            tile: this,
            width,
            height,
            measurements,
            index: newScreenLineIndex,
            screenLine: newScreenLine,
            screenRow: tileStartRow + newScreenLineIndex,
            lineDecoration: lineDecorations[newScreenLineIndex],
            textDecorations: textDecorations[newScreenLineIndex],
            highlightDecorations: highlightDecorations[newScreenLineIndex],
            displayLayer,
            lineComponentsByScreenLineId
          });
          // this.element.insertBefore(
          //   newScreenLineComponent.element,
          //   oldScreenLineComponent.element
          // );
          oldScreenLineComponent.destroy();
          this.lineComponents[lineComponentIndex] = newScreenLineComponent;

          oldScreenLineIndex++;
          newScreenLineIndex++;
          lineComponentIndex++;
        }
      }
    }
    this.queueDraw()
  }

  getFirstElementForScreenLine(oldProps, screenLine) {
    var blockDecorations = oldProps.blockDecorations
      ? oldProps.blockDecorations.get(screenLine.id)
      : null;
    if (blockDecorations) {
      var blockDecorationElementsBeforeOldScreenLine = [];
      for (let i = 0; i < blockDecorations.length; i++) {
        var decoration = blockDecorations[i];
        if (decoration.position !== 'after') {
          blockDecorationElementsBeforeOldScreenLine.push(
            TextEditor.viewForItem(decoration.item)
          );
        }
      }

      for (
        let i = 0;
        i < blockDecorationElementsBeforeOldScreenLine.length;
        i++
      ) {
        var blockDecorationElement =
          blockDecorationElementsBeforeOldScreenLine[i];
        if (
          !blockDecorationElementsBeforeOldScreenLine.includes(
            blockDecorationElement.previousSibling
          )
        ) {
          return blockDecorationElement;
        }
      }
    }

    return oldProps.lineComponentsByScreenLineId.get(screenLine.id).element;
  }

  updateBlockDecorations(oldProps, newProps) {
    const { parent, blockDecorations, lineComponentsByScreenLineId } = newProps;
    const rootComponent = newProps.element

    if (!rootComponent.hasInitialMeasurements)
      return

    if (oldProps.blockDecorations) {
      oldProps.blockDecorations.forEach((oldDecorations, screenLineId) => {
        const newDecorations = newProps.blockDecorations
          ? newProps.blockDecorations.get(screenLineId)
          : null;
        for (let i = 0; i < oldDecorations.length; i++) {
          const oldDecoration = oldDecorations[i];
          if (newDecorations && newDecorations.includes(oldDecoration))
            continue;

          const element = TextEditor.viewForItem(oldDecoration.item);
          element.getParent()?.remove(element)
        }
      })
    }

    if (blockDecorations) {
      const horizontalPadding = rootComponent.measurements.horizontalPadding
      blockDecorations.forEach((newDecorations, screenLineId) => {
        const oldDecorations = oldProps.blockDecorations
          ? oldProps.blockDecorations.get(screenLineId)
          : null;
        const line = lineComponentsByScreenLineId.get(screenLineId)

        for (let i = 0; i < newDecorations.length; i++) {
          const newDecoration = newDecorations[i];
          const element = TextEditor.viewForItem(newDecoration.item);

          if (oldDecorations && oldDecorations.includes(newDecoration)) {
            continue;
          }

          if (newDecoration.position === 'after') {
            const top =
                rootComponent.pixelPositionAfterBlocksForRow(line.props.screenRow)
              + rootComponent.measurements.lineHeight
            parent.put(element, horizontalPadding, top)
          } else {
            const top =
                rootComponent.pixelPositionBeforeBlocksForRow(line.props.screenRow)
            parent.put(element, horizontalPadding, top)
          }
        }
      })
    }
  }

  shouldUpdate(newProps) {
    return !isEqual(newProps, this.props)
  }

  snapshot(snapshot) {
    const { element, tileStartRow } = this.props

    // snapshot.appendColor(RED, Graphene.Rect.create(0, 0, 1, this.getAllocatedHeight()))
    // snapshot.appendColor(RED, Graphene.Rect.create(0, 0, this.getAllocatedWidth(), 1))

    /* Draw lines */
    let marginTop = 0
    for (let i = 0; i < this.lineComponents.length; i++) {
      const row = tileStartRow + i

      marginTop += element.heightForBlockDecorationsBeforeRow(row)

      const lineComponent = this.lineComponents[i]
      lineComponent.snapshot(snapshot, this.styleContext, this.textLayout, marginTop)

      marginTop += element.heightForBlockDecorationsAfterRow(row)
    }
  }
}

class LineComponent {
  constructor(props) {
    const {
      screenLine,
      lineComponentsByScreenLineId,
    } = props;
    this.props = props;
    this.rootNode = new SpanNode();

    this.appendContents();
    lineComponentsByScreenLineId.set(screenLine.id, this);
  }

  getText() {
    return this.rootNode.toString()
  }

  getMarkup() {
    return this.rootNode.toMarkup()
  }

  update(newProps) {
    // IIURC, line content never changes, if it does it's a new line,
    // thus we never update the content.

    if (this.props.lineDecoration !== newProps.lineDecoration) {
      this.props.lineDecoration = newProps.lineDecoration;
      // this.element.className = this.buildClassName();
      // FIXME make line decoration work
    }

    if (this.props.screenRow !== newProps.screenRow) {
      this.props.screenRow = newProps.screenRow;
      // this.element.dataset.screenRow = newProps.screenRow;
    }

    if (
      !textDecorationsEqual(
        this.props.textDecorations,
        newProps.textDecorations
      )
    ) {
      this.props.textDecorations = newProps.textDecorations;
      this.appendContents();
    }
    this.props = Object.assign({}, this.props, newProps)
  }

  destroy() {
    const { lineComponentsByScreenLineId, screenLine } = this.props;

    if (lineComponentsByScreenLineId.get(screenLine.id) === this) {
      lineComponentsByScreenLineId.delete(screenLine.id);
    }
  }

  appendContents() {
    const { displayLayer, screenLine, textDecorations } = this.props;

    const { lineText, tags } = screenLine;
    let openScopeNode = new SpanNode()

    let decorationIndex = 0;
    let column = 0;
    let activeClassName = null;
    let activeStyle = null;
    let nextDecoration = textDecorations ? textDecorations[decorationIndex] : null;
    if (nextDecoration && nextDecoration.column === 0) {
      column = nextDecoration.column;
      activeClassName = nextDecoration.className;
      activeStyle = nextDecoration.style;
      nextDecoration = textDecorations[++decorationIndex];
    }

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      if (tag === 0)
        continue

      if (displayLayer.isCloseTag(tag)) {
        openScopeNode = openScopeNode.parentElement;
      }
      else if (displayLayer.isOpenTag(tag)) {
        const className = displayLayer.classNameForTag(tag)
        const newScopeNode = new SpanNode(className);
        openScopeNode.appendChild(newScopeNode);
        openScopeNode = newScopeNode;
      }
      else {
        const nextTokenColumn = column + tag;
        while (nextDecoration && nextDecoration.column <= nextTokenColumn) {
          const text = lineText.substring(column, nextDecoration.column);
          openScopeNode.appendTextNode(
            text,
            activeClassName,
            activeStyle
          );
          column = nextDecoration.column;
          activeClassName = nextDecoration.className;
          activeStyle = nextDecoration.style;
          nextDecoration = textDecorations[++decorationIndex];
        }

        if (column < nextTokenColumn) {
          const text = lineText.substring(column, nextTokenColumn);
          openScopeNode.appendTextNode(
            text,
            activeClassName,
            activeStyle
          );
          column = nextTokenColumn;
        }
      }
    }

    if (lineText.endsWith(displayLayer.foldCharacter)) {
      // Insert a zero-width non-breaking whitespace, so that LinesYardstick can
      // take the fold-marker::after pseudo-element into account during
      // measurements when such marker is the last character on the line.
      openScopeNode.appendTextNode(ZERO_WIDTH_NBSP_CHARACTER)
    }

    this.rootNode = openScopeNode
  }

  buildClassName() {
    const { lineDecoration } = this.props;
    let className = 'line';
    if (lineDecoration != null) className = className + ' ' + lineDecoration;
    return className;
  }

  snapshot(snapshot, context, layout, marginTop) {
    const {
      index,
      measurements,
      lineDecoration,
    } = this.props

    const x = measurements.horizontalPadding
    const y = index * measurements.lineHeight + marginTop

    if (lineDecoration) {
      const style = getStyle(null, lineDecoration)
      if (style.background)
        snapshot.appendColor(style.background,
          Graphene.Rect.create(
            0,
            y,
            measurements.textContainerWidth,
            measurements.lineHeight,
          ))
    }

    /* Draw text */
    layout.setMarkup(this.getMarkup())
    snapshot.renderLayout(context, x, y, layout)
  }
}

class LineNumberGutterComponent extends Gtk.Widget {
  constructor(props) {
    super()
    this.props = props;
    this.focusable = false
    // TODO: implement mousedown handlers
    // TODO: render decorations
  }

  setupLayout(props) {
    if (!props.measurements.lineNumberGutterWidth || !props.measurements.lineHeight)
      return

    this.surface = new Cairo.ImageSurface(
      Cairo.Format.ARGB32,
      props.measurements.lineNumberGutterWidth,
      props.measurements.lineHeight
    )
    this.context = new Cairo.Context(this.surface)
    this.layout = PangoCairo.createLayout(this.context)
    this.layout.setFontDescription(props.font.description)
  }

  update(newProps) {
    if (
      this.props.measurements.lineHeight !== newProps.measurements.lineHeight ||
      this.props.measurements.lineNumberGutterWidth !== newProps.measurements.lineNumberGutterWidth
    )
      this.setupLayout(newProps)
    this.queueDraw()
    this.props = newProps;
  }

  snapshot(snapshot) {
    if (!this.layout)
      return

    const { rootComponent } = this.props

    const startRow = rootComponent.getRenderedStartRow();
    const endRow = rootComponent.getRenderedEndRow();
    const rowsPerTile = rootComponent.getRowsPerTile();
    const tileWidth = rootComponent.getScrollWidth();

    snapshot.pushClip(Graphene.Rect.create(0, 0, this.getAllocatedWidth(), this.getAllocatedHeight()))

    for (let i = 0; i < rootComponent.renderedTileStartRows.length; i++) {
      const tileStartRow = rootComponent.renderedTileStartRows[i];
      const tileEndRow = Math.min(endRow, tileStartRow + rowsPerTile);
      const tileHeight =
        rootComponent.pixelPositionBeforeBlocksForRow(tileEndRow) -
        rootComponent.pixelPositionBeforeBlocksForRow(tileStartRow);

      const props = {
        tileStartRow,
        tileEndRow,
        tileWidth,
        tileHeight,
        screenLines: rootComponent.renderedScreenLines.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        lineDecorations: rootComponent.decorationsToRender.lines.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        textDecorations: rootComponent.decorationsToRender.text.slice(
          tileStartRow - startRow,
          tileEndRow - startRow
        ),
        blockDecorations: rootComponent.decorationsToRender.blocks.get(tileStartRow),
        displayLayer: rootComponent.model.displayLayer,
      }

      this.snapshotTile(snapshot, props)
    }

    snapshot.pop()
  }

  snapshotTile(snapshot, tile) {
    const { rootComponent, model } = this.props
    const { tileStartRow, tileEndRow } = tile

    const renderedStartRow = rootComponent.getRenderedStartRow();

    const startRow = Math.max(rootComponent.getFirstVisibleRow() - 1, 0)
    const endRow   = Math.min(rootComponent.getLastVisibleRow(), model.getScreenLineCount())

    const { measurements, lineNumbersToRender } = rootComponent
    const {
      maxDigits,
      keys,
      bufferRows,
      screenRows,
      softWrappedFlags,
      foldableFlags,
    } = lineNumbersToRender
    const gutter = model.getLineNumberGutter()
    const decorations = rootComponent.decorationsToRender.lineNumbers.get(gutter.name) || []

    if (!bufferRows)
      return

    const tileOffsetTop = rootComponent.pixelPositionBeforeBlocksForRow(tileStartRow)
    const scrollTop = rootComponent.getScrollTop()
    let marginTop = 0

    for (let row = tileStartRow; row < tileEndRow; row++) {
      if (row < startRow)
        continue
      if (row > endRow)
        return
      const indexInTile = row - tileStartRow;
      const j = row - renderedStartRow;
      const key = keys[j];
      const softWrapped = softWrappedFlags[j];
      const foldable = foldableFlags[j];
      const bufferRow = bufferRows[j];
      const screenRow = screenRows[j];

      /* let className = 'line-number';
        * if (foldable) className = className + ' foldable'; */

      const decorationsForRow = decorations[j];
      const style = getStyle({
        foreground: rootComponent.theme.lineNumber,
      }, decorationsForRow)

      let number = null;
      {
        number = softWrapped ? SPACE_CHARACTER : String(bufferRow + 1);
        number = SPACE_CHARACTER.repeat(maxDigits - number.length + 1) + number
        number = number + (foldable ? '›' : SPACE_CHARACTER)
      }

      // We need to adjust the line number position to account for block
      // decorations preceding the current row and following the preceding
      // row. Note that we ignore the latter when the line number starts at
      // the beginning of the tile, because the tile will already be
      // positioned to take into account block decorations added after the
      // last row of the previous tile.
      marginTop += rootComponent.heightForBlockDecorationsBeforeRow(row);

      const x = 0
      const y =
        ((row - tileStartRow) * measurements.lineHeight)
        + marginTop
        + tileOffsetTop
        - scrollTop

      const markup = renderMarkup(style, number)

      this.layout.setMarkup(markup)
      snapshot.renderLayout(this.getStyleContext(), x, y, this.layout)

      marginTop += rootComponent.heightForBlockDecorationsAfterRow(
        row
      );
    }
  }

  didMouseDown(event) {
    if (this.props.onMouseDown == null) {
      this.props.rootComponent.didMouseDownOnLineNumberGutter(event);
    } else {
      const { bufferRow, screenRow } = event.target.dataset;
      this.props.onMouseDown({
        bufferRow: parseInt(bufferRow, 10),
        screenRow: parseInt(screenRow, 10),
        domEvent: event
      });
    }
  }

  didMouseMove(event) {
    if (this.props.onMouseMove != null) {
      const { bufferRow, screenRow } = event.target.dataset;
      this.props.onMouseMove({
        bufferRow: parseInt(bufferRow, 10),
        screenRow: parseInt(screenRow, 10),
        domEvent: event
      });
    }
  }
}

class BackgroundComponent extends Gtk.Widget {
  props = {
    width: 0,
    height: 0,
  }

  constructor(props) {
    super()
    this.focusable = false
    this.update(props)
  }

  update(newProps) {
    const oldProps = this.props
    this.props = Object.assign({}, this.props, newProps)
    if (this.props.width !== oldProps.width || this.props.height !== oldProps.height)
      this.setSizeRequest(newProps.width, newProps.height)
    this.queueDraw()
  }

  snapshot(snapshot) {
    const { width, height } = this.props
    snapshot.appendColor(
      theme.backgroundColor,
      Graphene.Rect.create(0, 0, width, height)
    )
  }
}

class CursorsComponent extends Gtk.DrawingArea {
  props = {
    element: null,
    width: 0,
    height: 0,
  }

  constructor(props) {
    super()
    this.canFocus = false
    this.focusable = false
    this.focusOnClick = false
    this.setCanTarget(false)
    this.update(props)
    this.setDrawFunc(this.onDraw.bind(this))
  }

  update(newProps) {
    const oldProps = this.props
    this.props = Object.assign({}, this.props, newProps)
    if (this.props.width !== oldProps.width || this.props.height !== oldProps.height)
      this.setSizeRequest(newProps.width, newProps.height)
    this.queueDraw()
  }

  onDraw(_, cx) {
    const { element, cursors } = this.props
    const blinkOff = element.cursorsBlinkedOff
    const hasFocus = element.hasFocus()
    const isActive = xedel.window ? xedel.window.isActive() : true
    const { measurements } = element

    if (!element.hasInitialMeasurements)
      return

    if (!hasFocus)
      return

    if (isActive && blinkOff)
      return

    const scrollTop  = element.getScrollTop()
    const scrollLeft = element.getScrollLeft()

    cx.translate(
      measurements.horizontalPadding - scrollLeft,
      measurements.verticalPadding   - scrollTop
    )

    for (let i = 0; i < cursors.length; i++) {
      const cursor = cursors[i]
      const { character, pixelTop, pixelLeft, pixelWidth } = cursor;

      if (hasFocus && isActive) {
        if (element.props.cursorType === CursorType.BLOCK) {
          cx.rectangle(
            pixelLeft,
            pixelTop,
            pixelWidth,
            measurements.lineHeight
          )
          cx.setColor(theme.cursorColor)
          cx.fill()
          if (character) {
            cx.setColor(theme.backgroundColor)
            cx.moveTo(pixelLeft, pixelTop)
            Font.draw(element.font.description, cx, character)
          }
        }
        else if (element.props.cursorType === CursorType.BEAM) {
          cx.rectangle(
            pixelLeft,
            pixelTop,
            1,
            measurements.lineHeight
          )
          cx.setColor(theme.cursorColor)
          cx.fill()
        }
        else if (element.props.cursorType === CursorType.UNDER) {
          const height = 5
          cx.rectangle(
            pixelLeft,
            pixelTop + measurements.lineHeight - height,
            pixelWidth,
            height
          )
          cx.setColor(theme.cursorColor)
          cx.fill()
          cx.setColor(theme.backgroundColor)
          cx.moveTo(pixelLeft, pixelTop)
          Font.draw(element.font.description, cx, character)
        }
      }
      else {
        cx.rectangle(
          pixelLeft + 0.5 - 1,
          pixelTop  + 0.5,
          pixelWidth,
          measurements.lineHeight
        )
        cx.setColor(theme.cursorColorInactive)
        cx.setLineWidth(1)
        cx.stroke()
      }
    }
  }
}

class HighlightsComponent extends Gtk.DrawingArea {
  constructor(props) {
    super()
    this.props = {};
    this.highlightComponentsByKey = new Map();
    this.onDraw = this.onDraw.bind(this)
    this.update(props);
    this.setDrawFunc(this.onDraw)
  }

  destroy() {
    this.highlightComponentsByKey.forEach(highlightComponent => {
      highlightComponent.destroy();
    });
    this.highlightComponentsByKey.clear();
  }

  update(newProps) {
    // const should = this.shouldUpdate(newProps)
    // console.log(should, this.props, newProps)
    if (true) {
      const oldProps = this.props;
      this.props = newProps;
      const { height, width, horizontalPadding, lineHeight, highlightDecorations } = this.props;

      if (newProps.width !== oldProps.width || newProps.height !== oldProps.height)
        this.setSizeRequest(width, height)

      const visibleHighlightDecorations = new Set();
      if (highlightDecorations) {
        for (let i = 0; i < highlightDecorations.length; i++) {
          const highlightDecoration = highlightDecorations[i];
          const highlightProps = Object.assign(
            {
              lineHeight,
              horizontalPadding,
              fullWidth: width
            },
            highlightDecorations[i]
          );

          let highlightComponent = this.highlightComponentsByKey.get(
            highlightDecoration.key
          );
          if (highlightComponent) {
            highlightComponent.update(highlightProps);
          } else {
            highlightComponent = new HighlightComponent(highlightProps);
            this.highlightComponentsByKey.set(
              highlightDecoration.key,
              highlightComponent
            );
          }

          highlightDecorations[i].flashRequested = false;
          visibleHighlightDecorations.add(highlightDecoration.key);
        }
      }

      this.highlightComponentsByKey.forEach((highlightComponent, key) => {
        if (!visibleHighlightDecorations.has(key)) {
          highlightComponent.destroy();
          this.highlightComponentsByKey.delete(key);
        }
      });

      this.queueDraw();
    }
  }

  shouldUpdate(newProps) {
    const oldProps = this.props;

    if (!newProps.hasInitialMeasurements) return false;

    if (oldProps.width !== newProps.width) return true;
    if (oldProps.height !== newProps.height) return true;
    if (oldProps.lineHeight !== newProps.lineHeight) return true;
    if (!oldProps.highlightDecorations && newProps.highlightDecorations)
      return true;
    if (oldProps.highlightDecorations && !newProps.highlightDecorations)
      return true;
    if (oldProps.highlightDecorations && newProps.highlightDecorations) {
      if (
        oldProps.highlightDecorations.length !==
        newProps.highlightDecorations.length
      )
        return true;

      for (
        let i = 0, length = oldProps.highlightDecorations.length;
        i < length;
        i++
      ) {
        const oldHighlight = oldProps.highlightDecorations[i];
        const newHighlight = newProps.highlightDecorations[i];
        if (oldHighlight.className !== newHighlight.className) return true;
        if (newHighlight.flashRequested) return true;
        if (oldHighlight.startPixelTop !== newHighlight.startPixelTop)
          return true;
        if (oldHighlight.startPixelLeft !== newHighlight.startPixelLeft)
          return true;
        if (oldHighlight.endPixelTop !== newHighlight.endPixelTop) return true;
        if (oldHighlight.endPixelLeft !== newHighlight.endPixelLeft)
          return true;
        if (!oldHighlight.screenRange.isEqual(newHighlight.screenRange))
          return true;
      }
    }
    return false;
  }

  onDraw(_, cx) {
    this.highlightComponentsByKey.forEach(highlightComponent => {
      highlightComponent.onDraw(cx)
    })
  }
}

class HighlightComponent {
  constructor(props) {
    this.update(props)
  }

  destroy() {
    if (this.timeoutsByClassName) {
      this.timeoutsByClassName.forEach(timeout => {
        window.clearTimeout(timeout);
      });
      this.timeoutsByClassName.clear();
    }
  }

  update(newProps) {
    this.props = newProps;
    if (newProps.flashRequested) this.performFlash();
  }

  performFlash() {
    // FIXME: implement this
    return;
    // const { flashClass, flashDuration } = this.props;
    // if (!this.timeoutsByClassName) this.timeoutsByClassName = new Map();

    // // If a flash of this class is already in progress, clear it early and
    // // flash again on the next frame to ensure CSS transitions apply to the
    // // second flash.
    // if (this.timeoutsByClassName.has(flashClass)) {
    //   window.clearTimeout(this.timeoutsByClassName.get(flashClass));
    //   this.timeoutsByClassName.delete(flashClass);
    //   this.element.removeCssClass(flashClass);
    //   requestAnimationFrame(() => this.performFlash());
    // } else {
    //   this.element.addCssClass(flashClass);
    //   this.timeoutsByClassName.set(
    //     flashClass,
    //     window.setTimeout(() => {
    //       this.element.removeCssClass(flashClass);
    //     }, flashDuration)
    //   );
    // }
  }

  onDraw(cx) {
    const {
      className,
      screenRange,
      fullWidth,
      lineHeight,
      horizontalPadding,
      startPixelTop,
      startPixelLeft,
      endPixelTop,
      endPixelLeft
    } = this.props;
    const style = getStyle(null, className);
    // const regionClassName = 'region ' + className;

    const x = startPixelLeft + horizontalPadding
    const y = startPixelTop
    const width  = endPixelLeft - startPixelLeft
    const height = endPixelTop  - startPixelTop

    if (screenRange.start.row === screenRange.end.row) {
      drawRect(cx, style,
        x,
        y,
        width,
        lineHeight,
      )
    } else {
      drawRect(cx, style,
        x,
        y,
        fullWidth,
        lineHeight,
      )

      if (screenRange.end.row - screenRange.start.row > 1) {
        drawRect(cx, style,
          horizontalPadding,
          y + lineHeight,
          fullWidth,
          height - 2 * lineHeight,
        )
      }

      if (endPixelLeft > 0) {
        drawRect(cx, style,
          horizontalPadding,
          endPixelTop - lineHeight,
          endPixelLeft,
          lineHeight,
        )
      }
    }
  }
}



gi.registerClass(TextEditorComponent)
// gi.registerClass(LineComponent)
gi.registerClass(LinesTileComponent)
gi.registerClass(LineNumberGutterComponent)
gi.registerClass(BackgroundComponent)
gi.registerClass(CursorsComponent)
gi.registerClass(HighlightsComponent)

module.exports = TextEditorComponent

function renderMarkup(style, text) {
  return `${renderOpenTag(style)}${escapeMarkup(text)}</span>`
}

function renderOpenTag(style) {
  let result = '<span'
  for (let key in style) {
    const value = style[key]
    switch (key) {
      case 'foreground': result += ` foreground="${Color.toString(value)}"`; break
      case 'background': result += ` background="${Color.toString(value)}"`; break
      case 'fontWeight': result += ` weight="${value}"`; break
      case 'fontFamily': result += ` font_family="${value}"`; break
      case 'size':       result += ` size="${value}"`; break
      case 'style':      result += ` style="${value}"`; break
    }
  }
  result += `>`
  return result
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

class SpanNode {
  constructor(className, style) {
    this.className = className
    this.style = style
  }

  appendChild(e) {
    this.children = this.children || []
    this.children.push(e)
    if (typeof e !== 'string')
      e.parentElement = this
  }

  appendTextNode(text, className, style) {
    let node = this
    if (className || style) {
      const decorationNode = new SpanNode(className, style)
      node.appendChild(decorationNode);
      node = decorationNode;
    }
    node.appendChild(text);
  }

  toMarkup() {
    if (!this.children)
      return ''
    let result = renderOpenTag(getStyle(this.style, this.className))
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i]
      if (typeof child === 'string')
        result += escapeMarkup(child)
      else
        result += child.toMarkup()
    }
    result += '</span>'
    return result
  }

  toString() {
    if (!this.children)
      return ''
    let result = ''
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i]
      if (typeof child === 'string')
        result += child
      else
        result += child.toString()
    }
    return result
  }
}

function ceilToPhysicalPixelBoundary(virtualPixelPosition) {
  return virtualPixelPosition;
  /*
   * const virtualPixelsPerPhysicalPixel = 1 / window.devicePixelRatio;
   * return (
   *   Math.ceil(virtualPixelPosition / virtualPixelsPerPhysicalPixel) *
   *   virtualPixelsPerPhysicalPixel
   * );
   */
}

let rangeForMeasurement;
function clientRectForRange(textNode, startIndex, endIndex) {
  if (!rangeForMeasurement) rangeForMeasurement = document.createRange();
  rangeForMeasurement.setStart(textNode, startIndex);
  rangeForMeasurement.setEnd(textNode, endIndex);
  return rangeForMeasurement.getBoundingClientRect();
}

function textDecorationsEqual(oldDecorations, newDecorations) {
  if (!oldDecorations && newDecorations) return false;
  if (oldDecorations && !newDecorations) return false;
  if (oldDecorations && newDecorations) {
    if (oldDecorations.length !== newDecorations.length) return false;
    for (let j = 0; j < oldDecorations.length; j++) {
      if (oldDecorations[j].column !== newDecorations[j].column) return false;
      if (oldDecorations[j].className !== newDecorations[j].className)
        return false;
      if (!objectsEqual(oldDecorations[j].style, newDecorations[j].style))
        return false;
    }
  }
  return true;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0, length = a.length; i < length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function objectsEqual(a, b) {
  if (!a && b) return false;
  if (a && !b) return false;
  if (a && b) {
    for (const key in a) {
      if (a[key] !== b[key]) return false;
    }
    for (const key in b) {
      if (a[key] !== b[key]) return false;
    }
  }
  return true;
}

function constrainRangeToRows(range, startRow, endRow) {
  if (range.start.row < startRow || range.end.row >= endRow) {
    range = range.copy();
    if (range.start.row < startRow) {
      range.start.row = startRow;
      range.start.column = 0;
    }
    if (range.end.row >= endRow) {
      range.end.row = endRow;
      range.end.column = 0;
    }
  }
  return range;
}

function debounce(fn, wait) {
  let timestamp, timeout;

  function later() {
    const last = Date.now() - timestamp;
    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      fn();
    }
  }

  return function() {
    timestamp = Date.now();
    if (!timeout) timeout = setTimeout(later, wait);
  };
}

function roundToPhysicalPixelBoundary(virtualPixelPosition) {
  return virtualPixelPosition
  /* const virtualPixelsPerPhysicalPixel = 1 / window.devicePixelRatio;
   * return (
   *   Math.round(virtualPixelPosition / virtualPixelsPerPhysicalPixel) *
   *   virtualPixelsPerPhysicalPixel
   * ); */
}

function getStyle(baseStyle, classNames) {
  if (!classNames)
    return baseStyle || {}

  if (!baseStyle)
    baseStyle = {}

  const names = classNames.split(' ')
  for (let name of names) {
    const style = decorationStyleByClass[name]
    if (!style)
      continue
    for (let prop in style) {
      baseStyle[prop] = style[prop]
    }
  }

  return baseStyle
}

function drawRect(cx, style, x, y, width, height) {
  if (style.background) {
    cx.roundedRectangle(x, y, width, height, 5)
    cx.setColor(style.background)
    cx.fill()
  }
  if (style.borderWidth && style.borderColor) {
    const isBorderWidthOdd = style.borderWidth % 2 === 1
    if (isBorderWidthOdd)
      cx.translate(0, 0.5)
    cx.roundedRectangle(x, y, width, height - (isBorderWidthOdd ? 1 : 0), 5)
    cx.setLineWidth(style.borderWidth)
    cx.setColor(style.borderColor)
    cx.stroke()
    if (isBorderWidthOdd)
      cx.translate(0, -0.5)
  }
}
