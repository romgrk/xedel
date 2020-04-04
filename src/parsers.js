/*
 * parsers.js
 */

const path = require('path')
const Parser = require('tree-sitter');

module.exports = {
  javascript: getParser('javascript'),
  json: getParser('json'),
  html: getParser('html'),
  css: getParser('css'),
  c: getParser('c'),
  cpp: getParser('cpp'),
  python: getParser('python'),

  guessLanguage,
}

const LANGUAGE_BY_EXTENSION = {
  '.js': 'javascript',
  '.json': 'json',
  '.html': 'html',
  '.css': 'css',
  '.c': 'c',
  '.h': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.hh': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.h++': 'cpp',
  '.py': 'python',
}

function guessLanguage(filename) {
  return LANGUAGE_BY_EXTENSION[path.extname(filename)]
}

function getParser(language) {
  const lang = require(`tree-sitter-${language}`)
  const parser = new Parser();
  parser.setLanguage(lang);
  return parser
}
