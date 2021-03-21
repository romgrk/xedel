/*
 * commands-manager.js
 */

class CommandsManager {
  commands = {}
  sources = {}

  get(command) {
    if (!this.commands[command])
      throw new Error(`Command '${command}' is not registered`)
    return this.commands[command]
  }

  add(element, commands) {
    const source = getSource()

    for (let command in commands) {
      if (command in this.commands) {
        console.warn(new Error(`Command '${command}' already exists`))
      }
      const effect = commands[command]
      this.commands[command] = { element, effect, source }
    }

    this.sources[source] = commands

    return () => {
      this.remove(source)
    }
  }

  remove(source) {
    const commands = this.sources[source]

    for (let command of commands) {
      delete this.commands[command]
    }

    delete this.sources[source]
  }
}

module.exports = CommandsManager


let nextId = 1
function getSource() {
  // https://stackoverflow.com/a/19788257/6303229

  const prepare = Error.prepareStackTrace

  try {
    const err = new Error()

    Error.prepareStackTrace = (err, stack) => { return stack }

    const currentfile = err.stack.shift().getFileName();

    while (err.stack.length) {
      const callSite = err.stack.shift()
      const filename = callSite.getFileName();

      if (filename !== currentfile)
        return `${filename}:${callSite.getLineNumber()}`
    }
  } catch (err) {}

  Error.prepareStackTrace = prepare

  return String(nextId++);
}
