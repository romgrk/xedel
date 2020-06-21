/*
 * font.js
 */


const gi = require('node-gtk')
const Cairo = gi.require('cairo')
const Pango = gi.require('Pango')
const PangoCairo = gi.require('PangoCairo')

const NORMAL_WIDTH_CHARACTER = 'x';
const DOUBLE_WIDTH_CHARACTER = '我';
const HALF_WIDTH_CHARACTER = 'ﾊ';
const KOREAN_CHARACTER = '세';

module.exports = {
  parse,
  measure,
}

const measureContext = new Cairo.Context(new Cairo.ImageSurface(Cairo.Format.RGB24, 800, 100))
const measureLayout = PangoCairo.createLayout(measureContext)

function parse(string) {
  const description = Pango.fontDescriptionFromString(string)

  /* Calculate dimensions */
  const cr = new Cairo.Context(new Cairo.ImageSurface(Cairo.Format.RGB24, 300, 300))
  const layout = PangoCairo.createLayout(cr)
  layout.setFontDescription(description)
  layout.setAlignment(Pango.Alignment.LEFT)

  const [
    charWidth,
    charHeight
  ] = measureSize(layout, NORMAL_WIDTH_CHARACTER)
  const [doubleWidth] = measureSize(layout, DOUBLE_WIDTH_CHARACTER)
  const [halfWidth] = measureSize(layout, HALF_WIDTH_CHARACTER)
  const [koreanWidth] = measureSize(layout, KOREAN_CHARACTER)

  return {
    string,
    description,
    charWidth,
    charHeight,
    doubleWidth,
    halfWidth,
    koreanWidth
  }
}

function measure(description, text) {
  measureLayout.setFontDescription(description)
  measureLayout.setAlignment(Pango.Alignment.LEFT)
  return measureSize(measureLayout, text)
}

// Helpers

function measureSize(layout, character) {
  layout.setMarkup(`<span>${character}</span>`)
  return layout.getPixelSize()
}
