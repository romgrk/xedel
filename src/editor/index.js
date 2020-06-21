/*
 * index.js
 */

const workspace = require('../workspace')

const TextEditor = require('./TextEditor')
const TextEditorModel = require('./TextEditorModel')
const Clipboard = require('./clipboard')

require('./keymap')

workspace.clipboard = new Clipboard()
TextEditorModel.setClipboard(workspace.clipboard)

module.exports = TextEditor
