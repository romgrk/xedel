/*
 * key.test.js
 */

const gi = require('node-gtk')
const Gdk = gi.require('Gdk', '4.0')
const { ModifierType, keyvalFromName } = Gdk

const Key = require('./key')

Gdk.init([])

describe('Key', () => {

  describe('.fromDescription()', () => {

    parse('i',       { name: 'i',   })
    parse('alt-i',   { alt: true,   name: 'i', })
    parse('ctrl-i',  { ctrl: true,  name: 'i', })
    parse('shift-i', { shift: true, name: 'i', })
    parse('I',       { shift: true, name: 'i', })
    parse('shift-I', { shift: true, name: 'i', })
    parse('ctrl-I',  { ctrl: true,  shift: true, name: 'i', })

    parse('shift-1', { shift: true, name: '1', })
    parse('!',       { shift: true, name: '1', })
    parse('ctrl-!',  { shift: true, name: '1', ctrl: true })

    parse('`',          { name: 'grave' })
    parse('grave',      { name: 'grave' })
    parse('ctrl-grave', { name: 'grave', ctrl: true })
    parse('ctrl-`',     { name: 'grave', ctrl: true })

    parse('ctrl-!',      { name: '1', ctrl: true, shift: true })
    parse('ctrl-exclam', { name: '1', ctrl: true, shift: true })

    parse('ctrl-alt-shift-super-a', { name: 'a', ctrl: true, alt: true, shift: true, super: true })

    parse('ctrl-leftarrow', { name: 'leftarrow', ctrl: true })

    parse('alt-@', { name: '2', alt: true, shift: true })

    parse('escape', { name: 'escape' })
    parse('Escape', { name: 'escape' })

    function parse(description, result) {
      it(`parses "${description}"`, () => {
        expect(Key.fromDescription(description)).toEqual(k(result))
      })
    }
  })

  describe('.fromEvent()', () => {

    parse(['a', ModifierType.CONTROL_MASK], { ctrl: true, name: 'a' })
    parse(['A', ModifierType.CONTROL_MASK], { ctrl: true, name: 'a', shift: true })
    parse(['Escape', ModifierType.CONTROL_MASK], { ctrl: true, name: 'escape' })

    function parse(description, result) {
      it(`parses "${description}"`, () => {
        const [name, state] = description
        const event = new Gdk.EventKey()
        event.keyval = keyvalFromName(name)
        event.state = state
        const kv = Key.fromEvent(event)
        kv.event = undefined // for .toEqual
        kv.string = undefined // for .toEqual
        expect(kv).toEqual(k(result))
      })
    }
  })

  describe('#toString()', () => {
    it('works', () => {
      expect(Key.fromDescription('ctrl-alt-shift-1').toString())
        .toEqual('ctrl-alt-shift-1')

      expect(Key.fromDescription('ctrl-alt-!').toString())
        .toEqual('ctrl-alt-shift-1')
    })
  })

  describe('#equals()', () => {
    it('works', () => {
      const k1 = Key.fromDescription('ctrl-alt-shift-1')
      const k2 = Key.fromDescription('ctrl-alt-!')

      expect(k1.equals(k2)).toBe(true)
    })
  })
})


function k(desc) {
  return {
    name: undefined,
    ctrl: false,
    alt: false,
    shift: false,
    super: false,
    event: undefined,
    string: undefined,
    ...desc
  }
}
