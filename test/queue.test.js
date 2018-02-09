// @flow

import { expect } from 'chai';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies

import WindowStub from '../lib/utils/window-stub';
import initAppManager from '../lib/app-manager';
import { delay } from '../lib/utils/timers';
import { awaitEvent } from './utils';

describe('Queueing state changes', () => {
  it('runs the init state changer and resets afterwards', async () => {
    const config = { apps: {}, fragments: {}, slots: {} };

    const windowStub = new WindowStub();
    const appManager = initAppManager(windowStub);

    const { getRunningStateChange } = appManager(config, new EventEmitter());

    const runningStateChange = getRunningStateChange();

    expect(runningStateChange).to.be.a('promise');

    const result = await runningStateChange;

    expect(runningStateChange).to.be.null;
    expect(result).to.be.undefined;

    expect(getRunningStateChange()).to.be.null;
  });

  it('skips over queued state changes if the state changes again while a state change is already in progress', async () => {
    const loadScript = async () => {
      await delay(20);
      return { version: 5 };
    };

    const config = {
      apps: {
        APP_A: { appPath: '/app-a', fragment: 'FRAGMENT_A' },
        APP_B: { appPath: '/app-b', fragment: 'FRAGMENT_B' },
        APP_C: { appPath: '/app-c', fragment: 'FRAGMENT_C' },
        APP_D: { appPath: '/app-d', fragment: 'FRAGMENT_D' },
      },
      fragments: {
        FRAGMENT_A: { loadScript, slot: 'MAIN' },
        FRAGMENT_B: { loadScript, slot: 'MAIN' },
        FRAGMENT_C: { loadScript, slot: 'MAIN' },
        FRAGMENT_D: { loadScript, slot: 'MAIN' },
      },
      slots: { MAIN: { querySelector: null } },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const appManager = initAppManager(windowStub);

    const { getRunningStateChange, getState } = appManager(config, new EventEmitter());

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_A');

    windowStub.history.pushState(null, null, '/app-b');
    windowStub.history.pushState(null, null, '/app-c');
    windowStub.history.pushState(null, null, '/app-d');

    const firstRunningStateChange = getRunningStateChange();

    expect(firstRunningStateChange).to.be.a('promise');

    await firstRunningStateChange;

    expect(getState().app.name).to.equals('APP_B');

    const secondRunningStateChange = getRunningStateChange();

    expect(secondRunningStateChange).to.be.a('promise');

    await secondRunningStateChange;

    expect(getRunningStateChange()).to.be.null;

    expect(getState().app.name).to.equals('APP_D');
  });

  it('propagates errors and tries to continue if a state change fails', async () => {
    const config = {
      apps: {
        APP_A: { appPath: '/app-a', fragment: 'FRAGMENT_A' },
        APP_B: { appPath: '/app-b', fragment: 'FRAGMENT_B' },
        APP_C: { appPath: '/app-c', fragment: 'FRAGMENT_C' },
      },
      fragments: {
        FRAGMENT_A: { loadScript: async () => ({ version: 5 }), slot: 'MAIN' },
        FRAGMENT_B: { loadScript: async () => ({ version: 5, render: (_container, _state) => { throw new Error('Nope'); } }), slot: 'MAIN' },
        FRAGMENT_C: { loadScript: async () => ({ version: 5 }), slot: 'MAIN' },
      },
      slots: { MAIN: { querySelector: '.blah' } },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const appManager = initAppManager(windowStub);
    const events = new EventEmitter();
    const { getState, getRunningStateChange } = appManager(config, events);

    await getRunningStateChange();

    windowStub.history.pushState(null, null, '/app-b');
    windowStub.history.pushState(null, null, '/app-c');

    const firstRunningStateChange = getRunningStateChange();

    expect(firstRunningStateChange).to.be.a('promise');

    const [err]: any = await awaitEvent(events, 'am-error');

    expect(err.code).to.equals('render');
    expect(err.message).to.contain('Nope');

    await firstRunningStateChange;

    expect(getState().app.name).to.equals('APP_C');

    const secondRunningStateChange = getRunningStateChange();

    expect(secondRunningStateChange).to.be.a('promise');

    await secondRunningStateChange;

    expect(getState().app.name).to.equals('APP_C');
    expect(getRunningStateChange()).to.be.null;
  });
});
