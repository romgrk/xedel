/*
 * cairo-prototype-extend.js
 */

const gi = require('node-gtk')
const Cairo = gi.require('cairo')
const Gdk = gi.require('Gdk', '3.0')

Cairo.Context.prototype.setColor = function setColor(c) {
  this.setSourceRgba(c.red, c.green, c.blue, c.alpha)
}

Cairo.Context.prototype.roundedRectangle =
function roundedRectangle(
  x,
  y,
  width,
  height,
  radius
) {
    this.moveTo(x + radius, y)
    this.lineTo(x + width - radius, y)
    this.curveTo(x + width, y, x + width, y, x + width, y + radius)
    this.lineTo(x + width, y + height - radius)
    this.curveTo(x + width, y + height, x + width, y + height, x + width - radius, y + height)
    this.lineTo(x + radius, y + height)
    this.curveTo(x, y + height, x, y + height, x, y + height - radius)
    this.lineTo(x, y + radius)
    this.curveTo(x, y, x, y, x + radius, y)
}

