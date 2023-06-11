module.exports = Object.assign(
  {},
  require('event-kit'),
  require('text-buffer'),
  {
    TextEditor: require('./editor/text-editor'),
  }
)
