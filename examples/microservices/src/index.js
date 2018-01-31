// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../dist/app-manager';

import config from './config';
import footerScript from './guests/footer-script';

const appManager = new AppManager(config, new EventEmitter());

appManager.on(AppManager.eventTitles.ERROR, ({ title, id, err }) => {
  footerScript.onError(JSON.stringify({ title, id, message: err.message }));
});

appManager.init();
