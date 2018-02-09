// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies

import WindowStub from '../lib/utils/window-stub';
import initAppManager from '../lib/app-manager';
import { awaitEvent } from './utils';

describe('multi-step browser test', () => {
  const mockA = {
    version: 5,
    hydrate: sinon.spy(),
    render: sinon.spy(),
    onStateChange: sinon.spy(),
    onUpdateStatus: sinon.spy(),
    unmount: sinon.spy(),
  };

  const mockB = {
    version: 4,
    hydrate: sinon.spy(),
    mount: sinon.spy(),
    onStateChange: sinon.spy(),
    onUpdateStatus: sinon.spy(),
    unmount: sinon.spy(),
  };

  const mockC = {
    version: 3,
    hydrate: sinon.spy(),
    mount: sinon.spy(),
    onStateChange: sinon.spy(),
    onUpdateStatus: sinon.spy(),
    unmount: sinon.spy(),
  };

  const config = {
    apps: {
      APP_A: { appPath: '/app-a', fragment: 'SCRIPT_A' },
      APP_B: { appPath: '/app-b', fragment: 'SCRIPT_B' },
      APP_C: { appPath: '/app-c', fragment: 'SCRIPT_C' },
    },
    slots: {
      APP: { querySelector: '.fragment' },
      OTHER: { querySelector: '.other' },
    },
    fragments: {
      SCRIPT_A: { slot: 'APP', loadScript: async () => mockA },
      SCRIPT_B: { slot: 'OTHER', loadScript: async () => mockB },
      SCRIPT_C: { slot: 'APP' },
    },
  };

  const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

  const appManager = initAppManager(windowStub);
  const events = new EventEmitter();

  const { getState, getRunningStateChange } = appManager(config, events);

  it('correctly initialises app manager with first fragment', async () => {
    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_A');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(0);
    expect(mockA.onUpdateStatus.callCount).to.equals(2);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(0);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.unmount.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(0);
  });

  it('browses to new app', async () => {
    windowStub.history.pushState({}, null, '/app-b');

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_B');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);
    expect(mockA.onUpdateStatus.callCount).to.equals(4);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(0);
    expect(mockB.unmount.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(2);
  });

  it('moves within an app', async () => {
    windowStub.history.pushState({}, null, '/app-b');

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_B');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);
    expect(mockA.onUpdateStatus.callCount).to.equals(4);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(1);
    expect(mockB.unmount.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(4);
  });

  it('moves back within an app', async () => {
    windowStub.history.go(-1);

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_B');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(0);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);
    expect(mockA.onUpdateStatus.callCount).to.equals(4);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(0);
    expect(mockB.onUpdateStatus.callCount).to.equals(6);
  });

  it('moves back to the old app', async () => {
    windowStub.history.back();

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_A');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(1);
    expect(mockA.onUpdateStatus.callCount).to.equals(6);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(1);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(1);
    expect(mockB.onUpdateStatus.callCount).to.equals(8);
  });

  it('moves forward again', async () => {
    windowStub.history.forward();

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_B');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(2);
    expect(mockA.onUpdateStatus.callCount).to.equals(8);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(1);
    expect(mockB.onUpdateStatus.callCount).to.equals(10);
  });

  it('If a fragment does not have a loadScript function, treat the app as an external link', async () => {
    windowStub.history.pushState({}, null, '/app-c');

    await awaitEvent(events, 'am-external-link');

    expect(getState().app.name).to.equals('APP_C');

    expect(mockA.hydrate.callCount).to.equals(1);
    expect(mockA.render.callCount).to.equals(1);
    expect(mockA.onStateChange.callCount).to.equals(0);
    expect(mockA.unmount.callCount).to.equals(2);
    expect(mockA.onUpdateStatus.callCount).to.equals(8);

    expect(mockB.hydrate.callCount).to.equals(0);
    expect(mockB.mount.callCount).to.equals(2);
    expect(mockB.onStateChange.callCount).to.equals(2);
    expect(mockB.unmount.callCount).to.equals(2);
    expect(mockB.onUpdateStatus.callCount).to.equals(12);

    expect(mockC.hydrate.callCount).to.equals(0);
    expect(mockC.mount.callCount).to.equals(0);
    expect(mockC.onStateChange.callCount).to.equals(0);
    expect(mockC.unmount.callCount).to.equals(0);
    expect(mockC.onUpdateStatus.callCount).to.equals(0);
  });

  it('should keep the history state in sync', () => {
    // $FlowFixMe
    const state = windowStub.history.getState();

    expect(state).to.deep.equals({
      data: {},
      url: '/app-c',
      hash: '/app-c',
      title: null,
    });
  });
});
