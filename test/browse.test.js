// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import { WindowStub, HistoryStub } from '../lib/utils/stubs';

import initAppManager from '../lib/app-manager';

describe('multi-step browser test', () => {
  function waitForIO() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  class MockA implements GuestAppVersion3Type {
    version = 3
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    unmount = sinon.spy()
  }

  class MockB implements GuestAppVersion3Type {
    version = 3
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    unmount = sinon.spy()
  }

  class MockC implements GuestAppVersion3Type {
    version = 3
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    unmount = sinon.spy()
  }

  const mockA = new MockA();
  const mockB = new MockB();
  const mockC = new MockC();

  const apps = {
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

    APP_C: {
      name: 'APP_C',
      appPath: '/app-c/:entityId?',
      display: ['SCRIPT_C'],
    },
  };

  const slots = {
    APP: {
      name: 'APP',
      elementClass: 'guest-app',
    },
  };

  const scripts = {
    SCRIPT_A: {
      name: 'SCRIPT_A',
      slots: ['APP'],
      managed: true,
      import() { return Promise.resolve(mockA); },
    },

    SCRIPT_B: {
      name: 'SCRIPT_B',
      slots: ['APP'],
      managed: true,
      import() { return Promise.resolve(mockB); },
    },

    SCRIPT_C: {
      name: 'SCRIPT_C',
      slots: ['ERROR'],
      managed: true,
      import() { return Promise.resolve(mockC); },
    },
  };

  let appManager;
  let historystub;

  before(() => {
    const config = {
      apps,
      slots,
      scripts,
    };

    const windowStub = new WindowStub('/app-a');

    historystub = new HistoryStub();

    const AppManager = initAppManager(windowStub, historystub);

    appManager = new AppManager(config);
    appManager.init();
  });

  it('correctly initialises app manager with first guest app', () => {
    expect(appManager._currentAppName).to.equals(apps.APP_A.name);

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

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

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

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

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

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

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

    expect(appManager._currentAppName).to.equals(apps.APP_A.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(1);
  });

  it('moves forward again', async () => {
    historystub.forward();

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(2);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(1);
  });

  it('does not mount app scripts in missing slots', async () => {
    historystub.pushState({}, null, '/app-c');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_C.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(2);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(2);

    expect(mockC.hydrate.callCount).to.equals(0);
    expect(mockC.mount.callCount).to.equals(0);
    expect(mockC.onStateChange.callCount).to.equals(0);
    expect(mockC.unmount.callCount).to.equals(0);
  });
});
