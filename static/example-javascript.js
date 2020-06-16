const x = require('file'),
      CONSTANT_VALUE = 42

const i = `interpo${x}lation`

const o = {
    value: CONSTANT_VALUE,
    method: function(y) { return x + y }
}

function test(val) {
    if (val === x) {
        return val
    }
    return val + x
}
