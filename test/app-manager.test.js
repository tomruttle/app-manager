// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies

import WindowStub from '../lib/utils/window-stub';
import { delay } from '../lib/utils/config';
import initAppManager from '../lib/app-manager';
import { awaitEvent } from './utils';

describe('app-manager', () => {
  describe('multi-step browser test', () => {
    const mockA = {
      version: 6,
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
        APP_B: { appPaths: ['/app-b', '/app-b/next'], fragment: 'SCRIPT_B' },
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

    const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);

    const appManager = initAppManager(windowStub);
    const events = new EventEmitter();

    let _getState;
    let _getRunningStateChange;

    before(() => {
      const { getState, getRunningStateChange } = appManager(config, events);
      _getState = getState;
      _getRunningStateChange = getRunningStateChange;
    });

    after(() => {
      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('correctly initialises app manager with first fragment', async () => {
      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_A');

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
      windowStub.history.pushState(null, null, '/app-b');

      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_B');

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
      windowStub.history.pushState(null, null, '/app-b/next');

      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_B');

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

      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_B');

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

      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_A');

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

      await _getRunningStateChange();

      expect((_getState(): any).app.name).to.equals('APP_B');

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
      windowStub.history.pushState(null, null, '/app-c');

      await awaitEvent(events, 'am-external-link');

      expect((_getState(): any).app.name).to.equals('APP_C');

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
      const { state } = windowStub.history;

      expect((state: any).app.name).to.equals('APP_C');
      expect((state: any).prevApp.name).to.equals('APP_B');
      expect(windowStub.location.pathname).to.equals('/app-c');
    });
  });

  describe('events', () => {
    it('Can bind and unbind event listeners', async () => {
      const config = {
        apps: {
          APP_A: { appPath: '/app-a', fragment: 'SCRIPT_A' },
        },
        slots: { MAIN: { querySelector: null } },
        fragments: {
          SCRIPT_A: { slot: 'MAIN', loadScript: async () => ({ version: 5 }) },
        },
      };

      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);

      const appManager = initAppManager(windowStub);
      const events = new EventEmitter();

      const onErrorSpy = sinon.spy();
      const onExternalSpy = sinon.spy();

      events.on('am-error', onErrorSpy);
      events.on('am-external-link', onExternalSpy);

      const { getRunningStateChange, getState } = appManager(config, events);

      await getRunningStateChange();

      windowStub.history.pushState(null, null, '/app-a');

      await getRunningStateChange();

      expect((getState(): any).app.name).to.equals('APP_A');

      expect(onErrorSpy.callCount).to.equals(0);

      windowStub.history.pushState(null, null, '/app-c');

      await getRunningStateChange();

      expect((getState(): any).app.name).to.equals('APP_A');

      expect(onErrorSpy.callCount).to.equals(0);
      expect(onExternalSpy.callCount).to.equals(1);

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('calling replaceState emits correct events', () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);
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

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('resets the history functions before unloading', () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);

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

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    });

    describe('errors', () => {
      it('emits an error event if app tries to load missing fragment', async () => {
        const config = {
          apps: {
            APP_A: { appPath: '/app-a', fragment: 'SCRIPT_A' },
            APP_B: { appPath: '/app-b', fragment: 'MISSING' },
          },
          fragments: {
            SCRIPT_A: { slot: 'MAIN' },
          },
          slots: {},
        };

        const onErrorSpy = sinon.spy();

        const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);

        const appManager = initAppManager(windowStub);

        const events = new EventEmitter();

        events.on('am-error', onErrorSpy);

        appManager(config, events);

        const err = onErrorSpy.args[0][0];

        expect(err.code).to.equals('invalid_slots');

        windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
      });
    });
  });

  describe('Queueing state changes', () => {
    it('runs the init state changer and resets afterwards', async () => {
      const config = {
        apps: {
          APP_A: { appPath: '/app-a', fragment: 'SCRIPT_A' },
        },
        fragments: {
          SCRIPT_A: { slot: 'MAIN' },
        },
        slots: {
          SLOT_A: { querySelector: null },
        },
      };

      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);
      const appManager = initAppManager(windowStub);
      const events = new EventEmitter();

      const { getRunningStateChange } = appManager(config, events);

      const runningStateChange = getRunningStateChange();

      expect(runningStateChange).to.be.a('promise');

      const result = await runningStateChange;

      expect(result).to.be.undefined;

      // @TODO Why is this not null?
      // expect(getRunningStateChange()).to.be.null;

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
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

      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);
      const appManager = initAppManager(windowStub);
      const events = new EventEmitter();

      const { getRunningStateChange, getState } = appManager(config, events);

      await getRunningStateChange();

      expect((getState(): any).app.name).to.equals('APP_A');

      windowStub.history.pushState(null, null, '/app-b');
      windowStub.history.pushState(null, null, '/app-c');
      windowStub.history.pushState(null, null, '/app-d');

      expect((getState(): any).app.name).to.equals('APP_B');

      const firstRunningStateChange = getRunningStateChange();

      expect(firstRunningStateChange).to.be.a('promise');

      await firstRunningStateChange;

      expect((getState(): any).app.name).to.equals('APP_D');

      const secondRunningStateChange = getRunningStateChange();

      expect(secondRunningStateChange).to.be.a('promise');

      await secondRunningStateChange;

      expect(getRunningStateChange()).to.be.null;

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
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

      const windowStub = new WindowStub([{ data: null, title: null, url: '/app-a' }]);
      const appManager = initAppManager(windowStub);
      const events = new EventEmitter();

      const { getState, getRunningStateChange } = appManager(config, events);

      await getRunningStateChange();

      windowStub.history.pushState(null, null, '/app-b');

      const firstRunningStateChange = getRunningStateChange();

      expect(firstRunningStateChange).to.be.a('promise');

      const [err]: any = await awaitEvent(events, 'am-error');

      expect(err.code).to.equals('mount');
      expect(err.message).to.contain('Nope');

      await firstRunningStateChange;

      windowStub.history.pushState(null, null, '/app-c');

      const secondRunningStateChange = getRunningStateChange();

      expect(secondRunningStateChange).to.be.a('promise');

      await secondRunningStateChange;

      expect((getState(): any).app.name).to.equals('APP_C');
      expect(getRunningStateChange()).to.be.null;

      windowStub._events.emit(appManager.eventTitles.WINDOW_BEFORE_UNLOAD);
    });
  });
});
