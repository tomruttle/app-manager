// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../../../dist/app-manager';
import getPathHelpers from '../../../../../lib/utils/path';

import config from '../common/config';

const appManager = new AppManager(config, new EventEmitter(), getPathHelpers(config.apps));

appManager.on(AppManager.eventTitles.EXTERNAL_LINK, () => {
  window.location.href = window.location.href;
});

appManager.init();
