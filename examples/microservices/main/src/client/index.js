// @flow

import EventEmitter from 'eventemitter3';

import appManager from '../../../../../dist/app-manager';

import config, { options } from '../common/config';

const events = new EventEmitter();

events.on('hc-no-route', ({ resource }) => {
  console.log(`navigating to ${resource}`);
  window.location.href = `${window.location.origin}${resource}`;
});

appManager(config, events, options);
