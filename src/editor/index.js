/*
 * index.js
 */

const workspace = require('../workspace')

const TextEditorComponent = require('./TextEditorComponent')
const TextEditorModel = require('./TextEditorModel')
const Clipboard = require('./clipboard')

require('./keymap')

workspace.clipboard = new Clipboard()
TextEditorModel.setClipboard(workspace.clipboard)

module.exports = TextEditorComponent
