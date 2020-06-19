/*
 * cairo-prototype-extend.js
 */

const gi = require('node-gtk')
const Cairo = gi.require('cairo')
const Gdk = gi.require('Gdk', '3.0')

Cairo.Context.prototype.setColor = function setColor(color) {
  /* const r = parseInt(hex.slice(1, 3), 16) / 255
   * const g = parseInt(hex.slice(3, 5), 16) / 255
   * const b = parseInt(hex.slice(5, 7), 16) / 255 */
  const c = new Gdk.RGBA()
  const success = c.parse(color)
  if (!success)
    throw new Error(`GdkRGBA.parse: invalid color: ${color}`)
  this.setSourceRgba(c.red, c.green, c.blue, c.alpha)
}

