/*
 * font.js
 */


const gi = require('node-gtk')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')

module.exports = {
  parse,
  getDoubleWidthCodePoints,
}

function parse(string) {
  const description = Pango.fontDescriptionFromString(string)

  /* Calculate dimensions */
  const cr = new Cairo.Context(new Cairo.ImageSurface(Cairo.Format.RGB24, 300, 300))
  const layout = PangoCairo.createLayout(cr)
  layout.setFontDescription(description)
  layout.setAlignment(Pango.Alignment.LEFT)

  layout.setMarkup('<span font_weight="bold">A</span>')
  const [boldWidth] = layout.getSize()

  layout.setMarkup('<span>A</span>')
  const [normalWidth] = layout.getSize()
  const [cellWidth, cellHeight] = layout.getPixelSize()

  const boldSpacing = normalWidth - boldWidth

  /* Find double-width chars */
  const doubleWidthChars = getDoubleWidthCodePoints(description)

  return {
    string,
    description,
    cellWidth,
    cellHeight,
    normalWidth,
    boldWidth,
    boldSpacing,
    doubleWidthChars,
  }
}

function getDoubleWidthCodePoints(fontDescription, range = [0x20, 50000]) {
  const cr = new Cairo.Context(new Cairo.ImageSurface(Cairo.Format.RGB24, 300, 300))
  const layout = PangoCairo.createLayout(cr)
  layout.setFontDescription(fontDescription)
  layout.setAlignment(Pango.Alignment.LEFT)

  layout.setText('A')
  const [baseWidth] = layout.getPixelSize()

  let index = 0
  let codePoints = []
  let chars = []

  for (let i = range[0]; i <= range[1]; i++) {
    const char = String.fromCodePoint(i)
    layout.setText(char)
    const [width] = layout.getPixelSize()
    if (width !== baseWidth) {
      codePoints.push(i)
      chars.push(char)
    }
  }

  return chars
}


// Helpers

