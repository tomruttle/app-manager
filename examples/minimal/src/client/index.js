const EventEmitter = require('eventemitter3');

const { default: appManager } = require('../../../../dist/app-manager');

const config = require('../common/config');

appManager(config, new EventEmitter());

module.exports = function handleClick(e) {
  window.history.pushState({}, null, e.currentTarget.pathname);
  e.preventDefault();
};
