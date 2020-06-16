/*
 * parsers.js
 */

const fs = require('fs').promises
const path = require('path')
const Parser = require('tree-sitter')
const {Query} = Parser
const createControllablePromise = require('./utils/create-controllable-promise')


const loaded = createControllablePromise()
const parsers = {}

const queries = []

module.exports = {
  loaded,
  parsers,
  queries,
  guessLanguage,
}

Promise.all([
  initParser('javascript'),
  initParser('json'),
  initParser('html'),
  initParser('css'),
  initParser('c'),
  initParser('cpp'),
  initParser('python'),
])
.then(() => loaded.resolve())

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

async function initParser(language) {
  const lang = require(`tree-sitter-${language}`)
  const parser = new Parser();
  parser.setLanguage(lang);

  let query;

  try {
    const filepath = require.resolve(`tree-sitter-${language}/queries/highlights.scm`)
    const queryBuffer = await fs.readFile(filepath)
    query = new Query(lang, queryBuffer)
  } catch (e) {}

  parsers[language] = { parser, query }
}
