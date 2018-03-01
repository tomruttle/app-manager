// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import initAppManager from '../lib/app-manager';
import { awaitEvent } from './utils';

describe('app-manager', () => {
  const windowStub = {
    document: {
      querySelector() { return (true: any); },
    },
  };

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

    const appManager = initAppManager(windowStub);

    let _stateChanger;

    before(() => {
      _stateChanger = appManager(config);
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

    it('If a fragment does not have a loadScript function, emit a missing-scripts event', async () => {
      windowStub.history.pushState(null, null, '/app-c');

      await awaitEvent(events, 'am-missing-scripts');

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

      const appManager = initAppManager(windowStub);

      appManager(config);

      const err = onErrorSpy.args[0][0];

      expect(err.code).to.equals('invalid_slots');
    });
  });
});
