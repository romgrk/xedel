/*
 * parsers.js
 */

const fs = require('fs').promises
const path = require('path')
const Parser = require('tree-sitter');
const createControllablePromise = require('./utils/create-controllable-promise')
const walkTree = require('./tree-sitter/walk-tree')

const isArray = Array.isArray

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

  try {
    const filepath = require.resolve(`tree-sitter-${language}/queries/highlights.scm`)
    const queries = (await fs.readFile(filepath)).toString()
  } catch (e) {}

  parsers[language] = parser
}

const identifierPattern = /[^a-zA-Z_0-9?-]/m
const tagPattern        = /[^.a-zA-Z_0-9?-]/m

class SchemeParser {
  index = 0
  input = undefined
  root = []
  stack = []

  constructor(input) {
    this.input = input
    this.stack.push(this.root)
  }

  parse() {
    return this.parseList()
  }

  parseList() {
    while (this.index < this.input.length - 1) {
      // console.log({ index: this.index, length: this.input.length })

      if (/\s/.test(this.currentChar)) {
        this.skipWhitespaces()
        continue
      }

      switch (this.currentChar) {
        case ';': this.parseComment(); continue
        case '(': this.parseOpenCons(); continue
        case '"': this.parseString(); continue
        case '@': this.parseTag(); continue
      }

      if (isIdentifier(this.currentChar)) {
        this.parseIdentifier()
        continue
      }

      break
    }

    return this.stack.pop()
  }

  skipWhitespaces() {
    while (/\s/.test(this.currentChar) && this.index < this.input.length)
      this.index++
  }

  parseOpenCons() {
    const list = []
    this.pushCurrent(list)
    this.stack.push(list)
    this.index++
    this.parseList()
    this.parseCloseCons()
    this.lastNode = list[0]
  }

  parseCloseCons() {
    if (this.currentChar === ')')
      this.index++
    else {
      console.log(this.root)
      console.log({ input: this.input.slice(this.index, this.index + 40) })
      throw new Error(
        `Unexpected char: ${this.input.slice(this.index, this.index + 10)} (${this.index})`)
    }
  }

  parseIdentifier() {
    const start = this.index
    const end = start + this.input.slice(start).search(identifierPattern)
    const value = this.input.slice(start, end)
    this.index = end

    let type = 'identifier'

    if (this.currentChar === ':') {
      type = 'label'
      this.index++
    }

    this.pushCurrent({ type, value })
  }

  parseTag() {
    const start = this.index + 1
    const end = start + this.input.slice(start).search(tagPattern)
    const value = this.input.slice(start, end)
    this.lastNode.tag = value
    this.index = end
  }

  parseString() {
    const start = this.index
    let escapeNext = false
    let result = ''
    let i = 0
    while (this.index < this.input.length) {
      this.index++;
      if (this.currentChar === '"' && !escapeNext) {
        break
      }
      else if (this.currentChar === '"' && escapeNext) {
        escapeNext = false
        result += '"'
      }
      else if (this.currentChar === '\\' && !escapeNext) {
        escapeNext = true
      }
      else if (this.currentChar === '\\' && escapeNext) {
        escapeNext = false
        result += '\\'
      }
      else if (escapeNext) {
        throw new Error(
          `Unexpected escape char: ${this.currentChar} (${this.index})`)
      }
      else {
        result += this.currentChar
      }
    }
    this.pushCurrent({ type: 'string', value: result })
    this.index++
  }

  parseComment() {
    const start = this.index
    const end = this.indexOf('\n')
    const comment = this.input.slice(start, end)
    this.currentCons.push(comment)
    this.index = end + 1
  }

  get currentCons() {
    return this.stack[this.stack.length - 1]
  }

  get currentChar() {
    return this.input.charAt(this.index)
  }

  pushCurrent(node) {
    this.lastNode = node
    this.currentCons.push(node)
  }

  indexOf(value, returnEndIndex = true) {
    const index = this.input.indexOf(value, this.index)
    if (index === -1 && returnEndIndex)
      return this.input.length
    return index
  }
}

function isIdentifier(char) {
  return /[a-zA-Z_]/.test(char)
}

function parseQueries(input) {
  const parser = new SchemeParser(input)
  return parser.parse()
}

function queryToTaggers(q) {
  console.log('QUERY', q)

  // "as" @keyword
  if (q.type === 'string') {
    return [
      (node, parent, ps, cb) => {
        if (node.isNamed || node.type !== q.value)
          return false
        cb(q.tag, node)
        return true
      }
    ]
  }

  // (number) @number
  // (template_substitution
  //   "${" @punctuation.special
  //    "}" @punctuation.special) @embedded
  if (isArray(q)) {
    const taggers = []
    const parentQ = isArray(q[0]) ? q[0][0] : q[0]
    const conditions = []

    for (let i = 1; i < q.length; i++) {
      const current = q[i]
      let ts = []

      if (isCondition(current)) {
        conditions.push(conditionToPredicate(current))
        continue
      }

      if (isString(current)) {
        ts = queryToTaggers(current)
      }

      if (isLabel(current)) {
        console.log('LABEL', current)
        const next = q[i++ + 1]
        /* conditions.push((node, parent, ps) => {
         *   const subNode = node[current.value + 'Node']
         *   return 
         * }) */
      }

      console.log('CURRENT', current)

      taggers.push(...ts.map(t => taggerWithParent(parentQ.value, t)))
    }

    // console.log('tag', parentQ.tag)
    if (parentQ.tag) {
      const t = (node, parent, ps, cb) => {
        if (!(node.isNamed && node.type === parentQ.value))
          return false
        if (!conditions.every(c => c(node, parent, ps)))
          return false
        cb(parentQ.tag, node)
        return true
      }
      // console.log({ conditions })
      // console.log(actualT.toString())
      taggers.push(t)
    }

    return taggers
  }

  return []
}

function isCondition(q) {
  return isArray(q) && q[0].value.endsWith('?')
}

function isString(q) {
  return q.type === 'string'
}

function isLabel(q) {
  return q.type === 'label'
}

function taggerWithParent(parentValue, t) {
  return (node, parent, parents, cb) =>
    parent.type === parentValue ? t(node, parent, parents, cb) : undefined
}

function conditionToPredicate(condition) {
  // (eq? @function.builtin "require")
  // (match? @constant "^[A-Z][A-Z_]+$")
  // (is-not? local)

  const name = condition[0].value
  const value = condition[1].value

  let predicate
  switch (name) {
    case 'eq?': {
      predicate = (node, parent, parents) => node.text === value
      break
    }
    case 'match?': {
      const pattern = new RegExp(value)
      predicate = (node, parent, parents) => pattern.test(node.text)
      break
    }
    case 'is-not?': {
      const what = value
      predicate = (node, parent, parents) => true
      console.warn(`unhandled predicate: ${name}`)
      break
    }
  }

  return predicate
}

const util = require('util')
util.inspect.defaultOptions = { depth: 8, maxArrayLength: Infinity }

Promise.all([
  fs.readFile('./test.js')
  .then(b => b.toString())
  .then(input => parsers.javascript.parse(input)),

  fs.readFile('/home/romgrk/github/xedel/node_modules/tree-sitter-javascript/queries/highlights.scm')
  .then(b => b.toString())
  .then(input => {
    const qs = parseQueries(input)
    // console.log('#'.repeat(60))
    // console.log(input)
    // console.log('#'.repeat(60))
    // console.log(qs)
    qs.forEach((q, i) => console.log(i, q))
    return qs
  })
])
.then(([tree, qsNodes]) => {

  const taggers =
    [
      // ...qsNodes
      qsNodes[2],
      qsNodes[13],
    ]
      .map(queryToTaggers)
      .flat()
      .filter(Boolean)

  queries.push(...taggers)

  /* console.log(tree.rootNode.toString())
   * walkTree(tree, (node) => {
   *   console.log(node.type, node.fields)
   * }) */
})

