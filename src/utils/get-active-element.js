/*
 * get-active-element.js
 */

module.exports = getActiveElements

function getActiveElements() {
  const activeElement = xedel.window.getFocus()
  if (!activeElement)
    return []
  const elements = [activeElement]
  let current = activeElement
  while (current && (current = current.getParent()) !== null) {
    elements.push(current)
  }

  return elements
}

