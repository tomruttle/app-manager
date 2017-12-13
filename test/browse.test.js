// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies

import WindowStub from '../lib/utils/window-stub';

import initAppManager from '../lib/app-manager';

import type { ScriptVersion3Type, ScriptVersion4Type } from '../lib/index';

describe('multi-step browser test', () => {
  function waitForIO() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  class MockA implements ScriptVersion4Type {
    version = 4
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    onUpdateStatus = sinon.spy()
    unmount = sinon.spy()
  }

  class MockB implements ScriptVersion4Type {
    version = 4
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    onUpdateStatus = sinon.spy()
    unmount = sinon.spy()
  }

  class MockC implements ScriptVersion3Type {
    version = 3
    hydrate = sinon.spy()
    mount = sinon.spy()
    onStateChange = sinon.spy()
    onUpdateStatus = sinon.spy()
    unmount = sinon.spy()
  }

  const mockA: ScriptVersion4Type = new MockA();
  const mockB: ScriptVersion4Type = new MockB();
  const mockC: ScriptVersion3Type = new MockC();

  const apps = {
    APP_A: {
      name: 'APP_A',
      appPath: '/app-a/:entityId?',
      fragments: ['SCRIPT_A'],
    },

    APP_B: {
      name: 'APP_B',
      appPath: '/app-b/:entityId?',
      fragments: ['SCRIPT_B'],
    },

    APP_C: {
      name: 'APP_C',
      appPath: '/app-c/:entityId?',
      fragments: ['SCRIPT_C'],
    },
  };

  const slots = {
    APP: {
      name: 'APP',
      elementClass: 'fragment',
    },
  };

  const fragments = {
    SCRIPT_A: {
      name: 'SCRIPT_A',
      slots: ['APP'],
      managed: true,
      load: () => Promise.resolve(mockA),
    },

    SCRIPT_B: {
      name: 'SCRIPT_B',
      slots: ['APP'],
      managed: true,
      load: () => Promise.resolve(mockB),
    },

    SCRIPT_C: {
      name: 'SCRIPT_C',
      slots: ['APP'],
      managed: true,
    },
  };

  let appManager;
  let windowStub;

  before(() => {
    const config = {
      apps,
      slots,
      fragments,
    };

    windowStub = new WindowStub([{ data: {}, title: null, hash: '/app-a' }]);

    const AppManager = initAppManager(windowStub);

    appManager = new AppManager(config, new EventEmitter());
  });

  it('correctly initialises app manager with first fragment', async () => {
    const initSuccess = await appManager.init();

    expect(initSuccess).to.be.true;

    expect(appManager._currentAppName).to.equals(apps.APP_A.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(0);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(0);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('browses to new app', async () => {
    windowStub.history.pushState({}, null, '/app-b');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(2);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(1);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves within an app', async () => {
    windowStub.history.pushState({}, null, '/app-b/entity');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(2);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(1);
    expect(mockB.onUpdateStatus.callCount).to.equals(3);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves back within an app', async () => {
    windowStub.history.go(-1);

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(2);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.onUpdateStatus.callCount).to.equals(5);
    expect(mockB.unmount.callCount).to.equals(0);
  });

  it('moves back to the old app', async () => {
    windowStub.history.back();

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_A.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(3);
    expect(mockA.unmount.callCount).to.equals(1);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.onUpdateStatus.callCount).to.equals(6);
    expect(mockB.unmount.callCount).to.equals(1);
  });

  it('moves forward again', async () => {
    windowStub.history.forward();

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(4);
    expect(mockA.unmount.callCount).to.equals(2);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.onUpdateStatus.callCount).to.equals(7);
    expect(mockB.unmount.callCount).to.equals(1);
  });

  it('does not mount app scripts with missing import functions', async () => {
    windowStub.history.pushState({}, null, '/app-c');

    await waitForIO();

    expect(appManager._currentAppName).to.equals(apps.APP_B.name);

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.mount.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(4);
    expect(mockA.unmount.callCount).to.equals(2);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.onUpdateStatus.callCount).to.equals(9);
    expect(mockB.unmount.callCount).to.equals(1);

    expect(mockC.hydrate.callCount).to.equals(0);
    expect(mockC.mount.callCount).to.equals(0);
    expect(mockC.onStateChange.callCount).to.equals(0);
    expect(mockC.unmount.callCount).to.equals(0);
  });

  it('should keep the history state in sync', () => {
    // $FlowFixMe
    const state = windowStub.history.getState();

    expect(state).to.deep.equals({
      data: {},
      hash: '/app-c',
      title: null,
    });
  });
});
