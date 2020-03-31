/*
 * key.test.js
 */

const Key = require('./key')

describe('Key', () => {

  describe('.fromDescription', () => {

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

    function parse(description, result) {
      it(`parses "${description}"`, () => {
        expect(Key.fromDescription(description)).toEqual(k(result))
      })
    }
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
