/*
 * walk-tree.js
 */

module.exports = walkTree

function walkTree(tree, fn) {
  let node = tree.rootNode
  let parents = []

  main: while (true) {
    while (node.firstChild) {
      if (node !== tree.rootNode)
        fn(node, parents[parents.length - 1], parents)
      parents.push(node)
      node = node.firstChild
    }

    fn(node, parents[parents.length - 1], parents)

    if (node.nextSibling) {
      node = node.nextSibling
      continue
    }

    while (true) {
      if (node.parent && node.parent.nextSibling) {
        parents.pop()
        node = node.parent.nextSibling
        continue main
      }
      if (node.parent) {
        parents.pop()
        node = node.parent
        continue
      }
      break
    }
    break
  }
}
