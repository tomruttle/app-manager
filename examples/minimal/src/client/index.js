const EventEmitter = require('eventemitter3');

const { default: appManager } = require('../../../../dist/app-manager');

const config = require('../common/config');

const events = new EventEmitter();

appManager(config, events);

events.on('*', (...args) => {
  console.error(...args);
})

module.exports = function handleClick(e) {
  window.history.pushState({}, null, e.currentTarget.pathname);
  e.preventDefault();
};
