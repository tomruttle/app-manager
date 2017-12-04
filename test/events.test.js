// @flow

import { expect } from 'chai';

import { WindowStub, HistoryStub } from '../lib/utils/stubs';
import decorateHistory from '../lib/utils/decorate-history';

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

    const windowStub = new WindowStub('/app-a');

    const historystub = decorateHistory(windowStub, new HistoryStub());

    const AppManager = initAppManager(windowStub, historystub);

    const appManager = new AppManager(config);

    AppManager.bindEvent('am-error', (data) => {
      if (data && data.title) {
        errorTitle = data.title;
      }
    });

    expect(appManager._status).to.equals('DEFAULT');

    historystub.pushState({}, null, '/app-b');

    await waitForIO();

    const success = await appManager.init();

    expect(success).to.be.false;
    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    expect(errorTitle).to.equals('init.no_route');

    historystub.pushState({}, null, '/app-a');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    AppManager.unbindEvent('am-error');

    historystub.pushState({}, null, '/app-c');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');
  });
});
