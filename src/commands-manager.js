/*
 * commands-manager.js
 */

const { Disposable } = require('event-kit');
const { translateSelector } = require('./utils/atom-compatibility')

class CommandsManager {
  commandsByName = {}
  sources = {}

  get(element, command) {
    if (this.commandsByName[element]?.[command] === undefined)
      throw new Error(`Command '${command}' is not registered`)
    return this.commandsByName[element][command]
  }

  add(element, commands) {
    const source = getSource()
    const name = translateSelector(element)

    if (!this.commandsByName[name])
      this.commandsByName[name] = {}

    const elementCommands = this.commandsByName[name]

    for (let command in commands) {
      if (command in elementCommands) {
        console.warn(new Error(`Command '${command}' already exists`))
      }
      const effect = commands[command]
      elementCommands[command] = { element: name, effect, source }
    }

    this.sources[source] =
      (this.sources[source] || []).concat({ element, commands })

    return new Disposable(() => {
      this.remove(source)
    })
  }

  remove(source) {
    this.sources[source].forEach(({ element, commands }) => {
      for (let command in commands) {
        delete this.commandsByName[element][command]
      }
    })
    delete this.sources[source]
  }
}

module.exports = CommandsManager


let nextId = 1
function getSource() {
  // https://stackoverflow.com/a/19788257/6303229

  let result = undefined
  const prepare = Error.prepareStackTrace

  try {
    const err = new Error()

    Error.prepareStackTrace = (err, stack) => { return stack }

    const currentfile = err.stack.shift().getFileName();

    while (err.stack.length) {
      const callSite = err.stack.shift()
      const filename = callSite.getFileName();

      if (filename !== currentfile) {
        result = `${filename}:${callSite.getLineNumber()}`
        break
      }
    }
  } catch (err) {
  } finally {
    result = String(nextId++)
  }

  Error.prepareStackTrace = prepare

  return result
}
