// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../../../dist/app-manager';

import config from '../common/config';

const appManager = new AppManager(config, new EventEmitter());

appManager.on(AppManager.eventTitles.ERROR, (err) => {
  /* eslint-disable no-console */
  console.error(err.message, `${err.source}.${err.code}`);
});

appManager.on(AppManager.eventTitles.EXTERNAL_LINK, () => {
  window.location.href = window.location.href;
});

appManager.init();
