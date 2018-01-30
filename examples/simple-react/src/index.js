// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../dist/app-manager';

import config from './config';

const appManager = new AppManager(config, new EventEmitter());

appManager.on(AppManager.eventTitles.ERROR, (data) => {
  /* eslint-disable no-console */
  console.error('An error has occurred: ', data);
});

appManager.init();
