// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../../../dist/app-manager';

import config from '../common/config';

const appManager = new AppManager(config, new EventEmitter());

appManager.on(AppManager.eventTitles.ERROR, ({ title, id, err }) => {
  /* eslint-disable no-console */
  console.error(title, id, err);
});

appManager.on(AppManager.eventTitles.EXTERNAL_LINK, () => {
  window.location.href = window.location.href;
});

appManager.init();
