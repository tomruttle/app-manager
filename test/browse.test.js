// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import { WindowStub, HistoryStub } from './utils/history-utils';

import initAppManager from '../lib/app-manager';

describe('multi-step browser test', () => {
  function waitForIO() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  class MockApp {
    version = 2
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    unmount = sinon.spy()
  }

  const analytics = { namaspace: 'test', error() {} };

  const mockB = new (class MockB extends MockApp {})();
  const mockA = new (class MockA extends MockApp {})();

  const appScriptImports = {
    SCRIPT_A: () => Promise.resolve(mockA),
    SCRIPT_B: () => Promise.resolve(mockB),
  };

  const guestApps = {
    APP_A: {
      name: 'APP_A',
      appPath: '/app-a/:entityId?',
      display: ['SCRIPT_A'],
    },
    APP_B: {
      name: 'APP_B',
      appPath: '/app-b/:entityId?',
      display: ['SCRIPT_B'],
    },
  };

  const appSlots = {
    APP: {
      name: 'APP',
      layout: 'main-content',
      elementClass: 'guest-app',
    },
  };

  const guestAppScripts = {
    SCRIPT_A: {
      name: 'SCRIPT_A',
      library: 'script-a',
      slots: ['APP'],
      managed: true,
      permission: 'VIEW_SCRIPT_A',
    },
    SCRIPT_B: {
      name: 'SCRIPT_B',
      library: 'script-b',
      slots: ['APP'],
      managed: true,
      permission: 'VIEW_SCRIPT_B',
    },
  };

  let appManager;
  let historystub;

  before(() => {
    const config = {
      appScriptImports,
      guestApps,
      appSlots,
      guestAppScripts,
    };

    const windowStub = new WindowStub('/app-a');

    historystub = new HistoryStub();

    const AppManager = initAppManager(windowStub, historystub);

    appManager = new AppManager(config, analytics);
    appManager.init();
  });

  it('correctly initialises app manager with first guest app', () => {
    expect(appManager._currentAppName).to.equals(guestApps.APP_A.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(0);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(0);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('browses to new app', async () => {
    historystub.pushState({}, null, '/app-b');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(guestApps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves within an app', async () => {
    historystub.pushState({}, null, '/app-b/entity');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(guestApps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(1);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves back within an app', async () => {
    historystub.back();

    await waitForIO();

    expect(appManager._currentAppName).to.equals(guestApps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves back to the old app', async () => {
    historystub.back();

    await waitForIO();

    expect(appManager._currentAppName).to.equals(guestApps.APP_A.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(1);
  });
});
