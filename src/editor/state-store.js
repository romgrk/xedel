const path = require('path')
const KeyValueStore = require('sqlite-objects').KeyValueStore

module.exports = class StateStore {
  constructor(databaseName, version) {
    this.connected = false;
    this.databaseName = databaseName;
    this.version = version;
  }

  get dbPromise() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const store = new KeyValueStore(
          path.join(xedel.cacheDirPath, 'state-store.db')
        )
        store.ready
          .then(() => { resolve(store) })
          .catch(reject)
      });
    }

    return this._dbPromise;
  }

  isConnected() {
    return this.connected;
  }

  connect() {
    return this.dbPromise.then(db => !!db);
  }

  save(key, value) {
    this.dbPromise.then(store => store.set(key, value))
  }

  load(key) {
    this.dbPromise.then(store => store.get(key))
  }

  delete(key) {
    this.dbPromise.then(store => store.delete(key))
  }

  clear() {
    return this.dbPromise.then(async store => {
      for (let key of await store.keys()) {
        await store.delete(key)
      }
    });
  }

  count() {
    return this.dbPromise.then(async store => {
      return (await store.keys()).length
    });
  }
};
