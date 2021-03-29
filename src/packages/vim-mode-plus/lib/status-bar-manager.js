const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const {Disposable} = require('atom')
const settings = require('./settings')

const LongModeStringTable = {
  normal: 'Normal',
  'operator-pending': 'Operator Pending',
  'visual.characterwise': 'Visual Characterwise',
  'visual.blockwise': 'Visual Blockwise',
  'visual.linewise': 'Visual Linewise',
  insert: 'Insert',
  'insert.replace': 'Insert Replace'
}

const SCOPE = 'status-bar-vim-mode-plus'

// FIXME: implement this
class StatusBarManager {
  constructor () {
    this.container = new Gtk.Box(Gtk.Orientation.HORIZONTAL)
    // this.container = document.createElement('div')
    // this.container.id = SCOPE
    // this.container.className = 'inline-block'

    // this.element = document.createElement('div')
    // this.container.appendChild(this.element)
  }

  init ({addRightTile}) {
    const tile = addRightTile({item: this.container, priority: 20})
    return new Disposable(() => tile.destroy())
  }

  clear () {
    // this.element.className = ''
    // this.element.textContent = ''
  }

  update (mode, submode) {
    // this.element.className = `${SCOPE}-${mode}`
    // switch (settings.get('statusBarModeStringStyle')) {
    //   case 'short':
    //     this.element.textContent = (mode[0] + (submode ? submode[0] : '')).toUpperCase()
    //     return
    //   case 'long':
    //     this.element.textContent = LongModeStringTable[mode + (submode ? `.${submode}` : '')]
    // }
  }
}

module.exports = new StatusBarManager()
