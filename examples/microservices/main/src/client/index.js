// @flow

import EventEmitter from 'eventemitter3';

import appManager from '../../../../../dist/app-manager';

import config, { options } from '../common/config';

const events = new EventEmitter();

events.on(appManager.eventTitles.HALTED, () => {
  const location = window.location.href;
  window.history.back();
  window.location.href = location;
});

appManager(config, events, options);
