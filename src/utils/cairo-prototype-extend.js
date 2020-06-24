/*
 * cairo-prototype-extend.js
 */

const gi = require('node-gtk')
const Cairo = gi.require('cairo')
const Gdk = gi.require('Gdk', '3.0')

Cairo.Context.prototype.setColor = function setColor(c) {
  this.setSourceRgba(c.red, c.green, c.blue, c.alpha)
}

