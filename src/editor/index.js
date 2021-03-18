/*
 * index.js
 */

const workspace = require('../workspace')

const TextEditorComponent = require('./TextEditorComponent')
const TextEditorModel = require('./TextEditorModel')
const clipboard = require('./clipboard')

require('./keymap')

TextEditorModel.setClipboard(clipboard)

module.exports = TextEditorComponent
