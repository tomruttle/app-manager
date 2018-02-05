// @flow

import { expect } from 'chai';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies
import sinon from 'sinon';

import WindowStub from '../lib/utils/window-stub';
import initAppManager from '../lib/app-manager';
import { awaitEvent } from './utils';

describe('events', () => {
  it('Can bind and unbind event listeners', async () => {
    const config = {
      apps: {
        APP_A: {
          appPath: '/app-a/:entityId?',
          fragments: ['SCRIPT_A'],
        },
      },
      slots: {
        MAIN: {
          querySelector: null,
        },
      },
      fragments: {
        SCRIPT_A: {
          slots: ['MAIN'],
          loadScript: async () => ({ version: 5 }),
        },
      },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

    const AppManager = initAppManager(windowStub);

    const appManager = new AppManager(config, new EventEmitter());

    const onErrorSpy = sinon.spy();
    const onExternalSpy = sinon.spy();

    appManager.on('am-error', onErrorSpy);
    appManager.on('am-external-link', onExternalSpy);

    expect(appManager._status).to.equals('UNINITIALISED');

    appManager.init();

    await appManager._runningStateChange;

    windowStub.history.pushState({}, null, '/app-a');

    await appManager._runningStateChange;

    expect(appManager._currentAppName).to.equals('APP_A');
    expect(appManager._status).to.equals('DEFAULT');

    expect(onErrorSpy.callCount).to.equals(0);

    windowStub.history.pushState(null, null, '/app-c');

    expect(appManager._currentAppName).to.equals('APP_A');
    expect(appManager._status).to.equals('DEFAULT');

    expect(onErrorSpy.callCount).to.equals(0);
    expect(onExternalSpy.callCount).to.equals(1);
  });

  it('calling replaceState emits correct events', () => {
    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const AppManager = initAppManager(windowStub);

    const config = { apps: {}, slots: {}, fragments: {} };
    const appManager = new AppManager(config, new EventEmitter());

    appManager.init();

    const replaceStateSpy = sinon.spy();
    const stateChangeSpy = sinon.spy();

    appManager.on(AppManager.eventTitles.HISTORY_REPLACE_STATE, replaceStateSpy);
    appManager.on(AppManager.eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

    windowStub.history.replaceState(null, null, '/app-c');

    expect(replaceStateSpy.calledOnce).to.be.true;
    expect(stateChangeSpy.calledOnce).to.be.true;
  });

  it('resets the history functions before unloading', () => {
    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

    const beforeunloadSpy = sinon.spy();
    const pushStateSpy = sinon.spy();
    const stateChangeSpy = sinon.spy();

    windowStub.onbeforeunload = beforeunloadSpy;

    const AppManager = initAppManager(windowStub);

    const config = { apps: {}, slots: {}, fragments: {} };
    const appManager = new AppManager(config, new EventEmitter());

    appManager.on(AppManager.eventTitles.HISTORY_PUSH_STATE, pushStateSpy);
    appManager.on(AppManager.eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

    appManager.init();

    windowStub._events.emit(AppManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    expect(beforeunloadSpy.calledOnce).to.be.true;

    windowStub.history.pushState(null, null, '/app-c');

    expect(pushStateSpy.called).to.be.false;
    expect(stateChangeSpy.called).to.be.false;
  });

  describe('errors', () => {
    it('emits an error event if app tries to load missing fragment', async () => {
      const config = {
        apps: {
          APP_A: {
            appPath: '/app-a',
            fragments: ['SCRIPT_A'],
          },
          APP_B: {
            appPath: '/app-b',
            fragments: ['MISSING'],
          },
        },
        fragments: {
          SCRIPT_A: {
            slots: ['MAIN'],
          },
        },
        slots: {},
      };

      const onErrorSpy = sinon.spy();

      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const AppManager = initAppManager(windowStub);

      const appManager = new AppManager(config, new EventEmitter());

      appManager.on('am-error', onErrorSpy);

      appManager.init();

      windowStub.history.pushState({}, null, '/app-b');

      await awaitEvent(appManager, 'am-error');

      const err = onErrorSpy.args[0][0];

      expect(err.code).to.equals('missing_fragment');
    });
  });
});
