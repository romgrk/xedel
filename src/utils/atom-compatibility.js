/*
 * atom-compatibility.js
 */

module.exports = {
  translateSelector,
}

function translateSelector(selector) {
  if (selector.includes('atom-text-editor'))
    return 'TextEditor'

  if (selector.includes('atom-workspace'))
    return 'Workspace'

  if (selector.includes('atom'))
    console.warn(`Untranslated selector: ${selector}`)

  return selector
}
