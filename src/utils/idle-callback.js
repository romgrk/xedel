/*
 * idle-callback.js
 */

module.exports = {
  requestIdleCallback: requestIdleCallbackShim,
  cancelIdleCallback: clearTimeout,
}

function requestIdleCallbackShim(callback) {
    var start = Date.now();
    return setTimeout(function () {
        callback({
            didTimeout: false,
            timeRemaining: function () { return Math.max(0, 12 - (Date.now() - start)); },
        });
    });
}
