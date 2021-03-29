/*
 * atom-compatibility.js
 */

const parser = require('postcss-selector-parser')
const { assert } = require('./assert')

const PLATFORM_PATTERN = /\.platform-(\w+)/

module.exports = {
  parseSelector,
  matchesRule,
  translateTag,
}

console.log(parseSelector('atom-workspace atom-text-editor:not([mini]).vim-mode-plus'))

function parseSelector(input) {
  const results = []

  const rules = input.split(',').map(r => r.trim())

  rules.forEach(ruleInput => {
    const important = ruleInput.endsWith('!important')
    const ruleCleanedInput = important ? ruleInput.replace('!important', '') : ruleInput

    parser(selectors => {
      const root = selectors
      root.nodes.forEach(selector => {
        const rule = parseRule(selector)
        rule.important = important

        const platformIndex = rule.description.findIndex(r => PLATFORM_PATTERN.test(descriptionToString(r)))
        if (platformIndex !== -1) {
          assert(platformIndex + 1 < rule.description.length)
          assert(rule.description[platformIndex + 1].combinator !== undefined)

          const platformString = descriptionToString(rule.description[platformIndex])
          const m = platformString.match(PLATFORM_PATTERN)
          rule.platform = m[1]
          rule.description.splice(platformIndex, 2)
        }

        results.push(rule)
      })
    }).processSync(ruleCleanedInput)
  })

  return results
}

function parseRule(selector) {
  const elements = []
  let current = { element: undefined, has: [], not: [] }
  selector.nodes.forEach(node => {
    switch (node.type) {
      case 'tag': {
        current.element = translateTag(node.value)
        break
      }
      case 'pseudo': {
        if (node.value === ':not')
          current.not.push(getValue(node.nodes[0].nodes[0]))
        else
          console.warn('Unhandled pseudo node value: ' + node.value)
        break
      }
      case 'attribute':
      case 'class': {
        current.has.push(getValue(node))
        break
      }
      case 'combinator': {
        elements.push(current)
        elements.push({ combinator: node.value })
        current = { element: undefined, has: [], not: [] }
        break
      }
      default: {
        console.warn('Unhandled selector node type: ' + node.type)
        break
      }
    }
  })
  elements.push(current)

  const element = elements[elements.length - 1].element

  if (!element)
    console.warn('Rule with no element: ' + selector.toString())

  return {
    element,
    description: elements,
  }
}

function matchesRule(element, rule) {
  if (rule.element && rule.element !== element.constructor.name)
    return false

  let current = element
  let combinator = undefined
  let distance = 0

  let i = rule.description.length - 1
  let node = rule.description[i--]

  while (current && node) {

    if (node.combinator) {
      combinator = node.combinator
      distance = 0
      node = rule.description[i--]
    }

    if (matchesNode(current, node)) {
      node = rule.description[i--]
      if (combinator === '>' && distance > 1)
        return false
      combinator = undefined
    }
    else {
      if (current === element)
        return false
    }

    current = current.getParent()
    distance += 1
  }

  if (node)
    return false

  return true
}

function matchesNode(element, node) {
  if (node.element && element.constructor.name !== node.element)
    return false
  if (node.has.length === 0 && node.not.length === 0)
    return true
  const classNames = element.getCssClasses()
  if (!node.has.every(c => classNames.includes(c)))
    return false
  if (!node.not.every(c => !classNames.includes(c)))
    return false
  return true
}

function descriptionToString(d) {
  if (d.combinator)
    return d.combinator
  return [d.element, ...d.has.map(c => `.${c}`), ...d.not.map(c => `:not(.${c})`)].join('')
}

function getValue(node) {
  switch (node.type) {
    case 'class': return node.value
    case 'attribute': return node._attribute
    default:
      unreachable()
  }
}

function translateTag(tag) {
  if (tag === 'atom-text-editor')
    return 'TextEditor'

  if (tag === 'atom-workspace')
    return 'Workspace'

  if (tag === 'atom-pane')
    return 'Pane'

  if (tag === 'body')
    return 'Window'

  if (tag.includes('atom'))
    console.warn(`Untranslated tag: ${tag}`)

  return tag
}
