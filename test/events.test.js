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
          appPath: '/app-a',
          fragment: 'SCRIPT_A',
        },
      },
      slots: {
        MAIN: {
          querySelector: null,
        },
      },
      fragments: {
        SCRIPT_A: {
          slot: 'MAIN',
          loadScript: async () => ({ version: 5 }),
        },
      },
    };

    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

    const appManager = initAppManager(windowStub);
    const events = new EventEmitter();

    const onErrorSpy = sinon.spy();
    const onExternalSpy = sinon.spy();

    events.on('am-error', onErrorSpy);
    events.on('am-external-link', onExternalSpy);

    const { getRunningStateChange, getState } = appManager(config, events);

    await getRunningStateChange();

    windowStub.history.pushState({}, null, '/app-a');

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_A');

    expect(onErrorSpy.callCount).to.equals(0);

    windowStub.history.pushState(null, null, '/app-c');

    await getRunningStateChange();

    expect(getState().app.name).to.equals('APP_A');

    expect(onErrorSpy.callCount).to.equals(0);
    expect(onExternalSpy.callCount).to.equals(1);
  });

  it('calling replaceState emits correct events', () => {
    const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
    const appManager = initAppManager(windowStub);

    const config = { apps: {}, slots: {}, fragments: {} };
    const events = new EventEmitter();

    const replaceStateSpy = sinon.spy();
    const stateChangeSpy = sinon.spy();

    events.on(appManager.eventTitles.HISTORY_REPLACE_STATE, replaceStateSpy);
    events.on(appManager.eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

    appManager(config, events);

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

    const appManager = initAppManager(windowStub);

    const config = { apps: {}, slots: {}, fragments: {} };
    const events = new EventEmitter();

    events.on(appManager.eventTitles.HISTORY_PUSH_STATE, pushStateSpy);
    events.on(appManager.eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

    appManager(config, events);

    windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
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
            fragment: 'SCRIPT_A',
          },
          APP_B: {
            appPath: '/app-b',
            fragment: 'MISSING',
          },
        },
        fragments: {
          SCRIPT_A: {
            slot: 'MAIN',
          },
        },
        slots: {},
      };

      const onErrorSpy = sinon.spy();

      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const appManager = initAppManager(windowStub);

      const events = new EventEmitter();

      events.on('am-error', onErrorSpy);

      appManager(config, events);

      windowStub.history.pushState({}, null, '/app-b');

      await awaitEvent(events, 'am-error');

      const err = onErrorSpy.args[0][0];

      expect(err.code).to.equals('invalid_slots');
    });
  });
});
