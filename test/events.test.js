// @flow

import { expect } from 'chai';
import EventEmitter from 'eventemitter3';

import WindowStub from '../lib/utils/window-stub';

import initAppManager from '../lib/app-manager';

describe('events', () => {
  function waitForIO() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  it('Can bind and unbind event listeners', async () => {
    let errorTitle;

    const apps = {
      APP_A: {
        name: 'APP_A',
        appPath: '/app-a/:entityId?',
        fragments: ['SCRIPT_A'],
      },
    };

    const config = {
      apps,
      slots: {},
      fragments: {},
    };

    const windowStub = new WindowStub([{ data: {}, title: null, hash: '/app-a' }]);

    const AppManager = initAppManager(windowStub);

    const appManager = new AppManager(config, new EventEmitter());

    function errorListener(data) {
      if (data && data.title) {
        errorTitle = data.title;
      }
    }

    appManager.on('am-error', errorListener);

    expect(appManager._status).to.equals('DEFAULT');

    windowStub.history.pushState({}, null, '/app-b');

    await waitForIO();

    const success = await appManager.init();

    expect(success).to.be.false;
    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    expect(errorTitle).to.equals('init.no_route');

    windowStub.history.pushState({}, null, '/app-a');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    appManager.removeListener('am-error', errorListener);

    windowStub.history.pushState({}, null, '/app-c');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');
  });
});
