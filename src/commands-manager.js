/*
 * commands-manager.js
 */

const { Emitter, Disposable } = require('event-kit');
const { parseSelector, matchesRule } = require('./utils/selectors')
const { unreachable } = require('./utils/assert')
const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

class CommandsManager {
  commandsByName = {}
  commandsByElement = new WeakMap()
  sources = {}
  emitter = new Emitter()

  get(element, command) {
    const commandBundles =
      (this.commandsByName[element.constructor.name] || [])
        .concat(this.commandsByElement.get(element) || [])

    for (let i = 0; i < commandBundles.length; i++) {
      const bundle = commandBundles[i]
      if (bundle.rule !== true && !matchesRule(element, bundle.rule))
        continue
      if (command in bundle.commands)
        return bundle.commands[command]
    }

    console.warn(`Command '${command}' is not registered for ${element.constructor.name}`)
  }

  add(element, commands) {
    const source = getSource()

    if (typeof element === 'string') {
      const selector = element
      const rules = parseSelector(selector)

      rules.forEach(rule => {
        const name = rule.element

        if (!name) {
          console.warn('No name for rule', rule)
          return
        }

        if (!this.commandsByName[name])
          this.commandsByName[name] = []

        this.commandsByName[name].push({
          source,
          rule,
          commands,
        })
      })

      this.sources[source] =
        (this.sources[source] || []).concat({ selector, commands })

      return new Disposable(() => {
        this.remove(source)
      })
    }
    else if (element instanceof Gtk.Widget) {
      if (!this.commandsByElement.has(element))
        this.commandsByElement.set(element, [])

      this.commandsByElement.get(element).push({
        source,
        rule: true,
        commands,
      })

      return new Disposable(() => {
        this.remove(source, element)
      })
    }
    else {
      unreachable()
    }

  }

  remove(source, element) {
    if (!element) {
      for (let name in this.commandsByName) {
        this.commandsByName[name] =
          this.commandsByName[name].filter(c => c.source === source)
      }
      delete this.sources[source]
    }
    else {
      const bundles = this.commandsByElement.get(element)
      this.commandsByElement.set(element,
        bundles.filter(k => k.source === source)
      )
    }
  }

  dispatch(element, commandName) {
    const event = new CommandEvent(commandName)
    let effect

    if (typeof commandName === 'string') {
      effect = this.get(element, commandName)
      if (!effect)
        return false
    }
    else if (typeof commandName === 'function') {
      effect = commandName
    }
    else {
      unreachable()
    }

    if (typeof effect === 'function') {
      effect.call(element, event, element)
    }
    else if (typeof effect === 'object' && typeof effect.didDispatch === 'function') {
      effect.didDispatch.call(element, event, element)
    }
    else {
      unreachable()
    }

    const didDispatch = event.aborted === false
    if (didDispatch)
      this.emitter.emit('did-dispatch', event)
    return didDispatch
  }

  onDidDispatch(fn) {
    return this.emitter.on('did-dispatch', fn)
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

class CommandEvent {
  stopPropagationCalled = false
  aborted = false

  constructor(type) {
    this.type = type
  }

  stopPropagation() {
    this.stopPropagationCalled = true
  }

  abortKeyBinding() {
    this.aborted = true
  }
}
