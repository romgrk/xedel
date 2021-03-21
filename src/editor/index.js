/*
 * index.js
 */

const TextEditorComponent = require('./text-editor-component')
const TextEditorModel = require('./text-editor')
const clipboard = require('./clipboard')

require('./keymap')

TextEditorModel.setClipboard(clipboard)

module.exports = TextEditorComponent
