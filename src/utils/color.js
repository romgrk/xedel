/*
 * color.js
 */

const _ = require('underscore-plus')
const gi = require('node-gtk')
const Gdk = gi.require('Gdk', '4.0')

module.exports = {
  parseObject,
  parse,
  toString,
}

function parseObject(theme) {
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]) =>
      [
        key,
        isProbablyColor(value) ? parse(value) :
             _.isObject(value) ? parseObject(value) :
                                 value
      ]))
}

function parse(color) {
  const c = new Gdk.RGBA()
  const success = c.parse(color)
  if (!success)
    throw new Error(`GdkRGBA.parse: invalid color: ${color}`) 
  c.original = color
  c.string = toString(c)
  return c
}

function toString(c) {
  return c.string ??
    ('#'
    + Math.round(c.red * 255).toString(16)
    + Math.round(c.green * 255).toString(16)
    + Math.round(c.blue * 255).toString(16)
    + (c.alpha < 1 ? Math.round(c.alpha * 255).toString(16) : '')
    )
}


// Helpers

function isProbablyColor(v) {
  return typeof v === 'string' &&
    (v.startsWith('rgba(') || v.startsWith('#'))
}
