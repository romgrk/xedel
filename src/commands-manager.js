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

  registerCommands(source, commands) {
    if (source in this.sources) {
      console.error(new Error(`Source '${source}' already exists`))
      return
    }

    for (let command in commands) {
      if (command in this.commands) {
        console.error(new Error(`Command '${command}' already exists (from source ${source})`))
        continue
      }
      const effect = commands[command]
      this.commands[command] = { source, effect }
    }

    this.sources[source] = commands
  }

  unregisterCommands(source) {
    const commands = this.sources[source]

    for (let command of commands) {
      delete this.commands[command]
    }

    delete this.sources[source]
  }
}

module.exports = CommandsManager
