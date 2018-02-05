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
    const AppManager = initAppManager(windowStub);
    const appManager = new AppManager(config, new EventEmitter());

    expect(appManager._runningStateChange).to.be.null;

    appManager.init();

    expect(appManager._runningStateChange).to.be.a('promise');

    const result = await appManager._runningStateChange;

    expect(appManager._runningStateChange).to.be.null;
    expect(appManager._queuedStateChange).to.be.null;
    expect(result).to.be.undefined;
  });

  it('skips over queued state changes if the state changes again while a state change is already in progress', async () => {
    const loadScript = async () => {
      await delay(20);
      return { version: 5 };
    };

    const config = {
      apps: {
        APP_A: { appPath: '/app-a', fragments: ['FRAGMENT_A'] },
        APP_B: { appPath: '/app-b', fragments: ['FRAGMENT_B'] },
        APP_C: { appPath: '/app-c', fragments: ['FRAGMENT_C'] },
        APP_D: { appPath: '/app-d', fragments: ['FRAGMENT_D'] },
      },
      fragments: {
        FRAGMENT_A: { loadScript, slots: ['MAIN'] },
        FRAGMENT_B: { loadScript, slots: ['MAIN'] },
        FRAGMENT_C: { loadScript, slots: ['MAIN'] },
        FRAGMENT_D: { loadScript, slots: ['MAIN'] },
      },
      slots: { MAIN: { querySelector: null } },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const AppManager = initAppManager(windowStub);
    const appManager = new AppManager(config, new EventEmitter());

    expect(appManager._runningStateChange).to.be.null;

    appManager.init();

    await appManager._runningStateChange;

    expect(appManager._resolvedFragments).to.have.keys(['FRAGMENT_A']);

    windowStub.history.pushState(null, null, '/app-b');
    windowStub.history.pushState(null, null, '/app-c');
    windowStub.history.pushState(null, null, '/app-d');

    let queuedStateChange = appManager._queuedStateChange;
    let runningStateChange = appManager._runningStateChange;

    expect(runningStateChange).to.be.a('promise');
    expect(queuedStateChange).to.be.a('function');

    await runningStateChange;

    queuedStateChange = appManager._queuedStateChange;
    runningStateChange = appManager._runningStateChange;

    expect(runningStateChange).to.be.a('promise');
    expect(queuedStateChange).to.be.null;

    expect(appManager._resolvedFragments).to.have.keys(['FRAGMENT_A', 'FRAGMENT_B']);

    await runningStateChange;

    expect(appManager._queuedStateChange).to.be.null;
    expect(appManager._runningStateChange).to.be.null;

    expect(appManager._resolvedFragments).to.have.keys(['FRAGMENT_A', 'FRAGMENT_B', 'FRAGMENT_D']);

    expect(appManager._currentAppName).to.equals('APP_D');
  });

  it('propagates errors and tries to continue if a state change fails', async () => {
    const config = {
      apps: {
        APP_A: { appPath: '/app-a', fragments: ['FRAGMENT_A'] },
        APP_B: { appPath: '/app-b', fragments: ['FRAGMENT_B'] },
        APP_C: { appPath: '/app-c', fragments: ['FRAGMENT_C'] },
      },
      fragments: {
        FRAGMENT_A: { loadScript: async () => ({ version: 5 }), slots: ['MAIN'] },
        FRAGMENT_B: { loadScript: async () => { throw new Error('Failed to load'); }, slots: ['MAIN'] },
        FRAGMENT_C: { loadScript: async () => ({ version: 5 }), slots: ['MAIN'] },
      },
      slots: { MAIN: { querySelector: null } },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const AppManager = initAppManager(windowStub);
    const appManager = new AppManager(config, new EventEmitter());

    expect(appManager._runningStateChange).to.be.null;

    appManager.init();

    await appManager._runningStateChange;

    windowStub.history.pushState(null, null, '/app-b');
    windowStub.history.pushState(null, null, '/app-c');

    const [err]: any = await awaitEvent(appManager, 'am-error');

    expect(err.code).to.equals('load_script');
    expect(err.message).to.contain('Failed to load');

    await appManager._runningStateChange;

    expect(appManager._currentAppName).to.equals('APP_C');
    expect(appManager._resolvedFragments).to.have.keys(['FRAGMENT_A', 'FRAGMENT_C']);

    expect(appManager._runningStateChange).to.be.null;
    expect(appManager._queuedStateChange).to.be.null;
  });
});
