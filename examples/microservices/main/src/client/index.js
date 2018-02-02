// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../../../dist/app-manager';

import config, { loadScriptFromWindow } from '../common/config';

const appManager = new AppManager(config, new EventEmitter());

(async () => {
  const footerScript = await loadScriptFromWindow('footer')();

  appManager.on(AppManager.eventTitles.ERROR, (err) => {
    footerScript.onError(`ERROR: ${err.message} (${err.source}.${err.code})`);
  });
})();

appManager.on(AppManager.eventTitles.EXTERNAL_LINK, () => {
  window.location.href = window.location.href;
});

appManager.init();
