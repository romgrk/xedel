/*
 * atom-model.js
 */

let nextInstanceId = 1;

class Model {
  static initClass() {
    this.prototype.alive = true;
  }
  static resetNextInstanceId() { return nextInstanceId = 1; }

  constructor(params) {
    this.assignId(params != null ? params.id : undefined);
  }

  assignId(id) {
    if (this.id == null) { this.id = id != null ? id : nextInstanceId++; }
    if (id >= nextInstanceId) { return nextInstanceId = id + 1; }
  }

  destroy() {
    if (!this.isAlive()) { return; }
    this.alive = false;
    return (typeof this.destroyed === 'function' ? this.destroyed() : undefined);
  }

  isAlive() { return this.alive; }

  isDestroyed() { return !this.isAlive(); }
}

Model.initClass()

module.exports = Model
