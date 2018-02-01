const EventEmitter = require('eventemitter3');

const { default: AppManager } = require('../../../../dist/app-manager');

const config = require('../common/config');

const appManager = new AppManager(config, new EventEmitter());

appManager.init();

module.exports = function handleClick(e) {
  window.history.pushState({}, null, e.currentTarget.pathname);
  e.preventDefault();
};
