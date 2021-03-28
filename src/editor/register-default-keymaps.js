/*
 * register-default-keymaps.js
 */

const fs = require('fs')
const path = require('path')
const CSON = require('season')

module.exports = function({keymaps, config, notificationManager, project, clipboard}) {
  const paths = [
    path.join(__dirname, '../../keymaps/base.cson'),
    path.join(__dirname, `../../keymaps/${process.platform}.cson`),
  ]

  return Promise.all(
    paths.map(filepath =>
      fs.promises.readFile(filepath)
        .then(buffer => buffer.toString())
        .then(CSON.parse)
        .then(keymap => {
          keymaps.add(filepath, keymap)
        })
    )
  )
};
