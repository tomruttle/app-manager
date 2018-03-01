// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import initAppManager from '../lib/app-manager';

describe('app-manager', () => {
  const appManager = initAppManager({
    document: {
      querySelector() { return (true: any); },
    },
  });

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

    const onError = sinon.spy();

    let stateChanger;

    before(() => {
      stateChanger = appManager(config, { onError });
    });

    it('correctly initialises app manager with first fragment', async () => {
      const proceed = await stateChanger({ resource: '/app-a' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_A');

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
      const proceed = await stateChanger({ resource: '/app-b' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_B');

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
      const proceed = await stateChanger({ resource: '/app-b/next' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_B');

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
      const proceed = await stateChanger({ resource: '/app-b' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_B');

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
      const proceed = await stateChanger({ resource: '/app-a' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_A');

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
      const proceed = await stateChanger({ resource: '/app-b' });

      expect(proceed).to.be.true;
      expect(stateChanger.getState().app.name).to.equals('APP_B');

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
      const proceed = await stateChanger({ resource: '/app-c' });

      expect(proceed).to.be.false;
      expect(stateChanger.getState().app.name).to.equals('APP_C');

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

    it('Expect there to have been no errors', () => {
      expect(onError.called).to.be.false;
    });
  });

  describe('errors', () => {
    it('emits an error event if app tries to load missing fragment', async () => {
      const config = {
        apps: {
          APP_A: { appPath: '/app-a', fragment: 'MISSING' },
        },
        fragments: {},
        slots: {},
      };

      const stateChanger = appManager(config);

      try {
        await stateChanger({ resource: '/app-a' });
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.code).to.equals('missing_fragment');
      }
    });
  });

  describe('Lifecycle', () => {
    function getSpyScript() {
      return {
        version: 5,
        onStateChange: sinon.spy(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.spy(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };
    }

    describe('setup page', () => {
      it('hydrates a script with no errors', async () => {
        const appScript = getSpyScript();

        const config = {
          apps: {
            APP_A: { appPath: '/app-a', fragment: 'SCRIPT_A' },
          },
          fragments: {
            SCRIPT_A: { slot: 'MAIN', loadScript() { return appScript; } },
          },
          slots: {
            MAIN: { querySelector: null },
          },
        };

        const stateChanger = appManager(config);

        await stateChanger({ resource: '/app-a' });

        expect(appScript.onStateChange.callCount).to.equals(0);
        expect(appScript.render.callCount).to.equals(0);
        expect(appScript.hydrate.callCount).to.equals(1);
        expect(appScript.unmount.callCount).to.equals(0);
        expect(appScript.onUpdateStatus.callCount).to.equals(2);

        const [loadingCall, defaultCall] = appScript.onUpdateStatus.args;
        expect(loadingCall[0].status).to.equals('LOADING');
        expect(defaultCall[0].status).to.equals('DEFAULT');
      });

      it('handles errors on hydrate', async () => {
        const headerScript = getSpyScript();

        const errorScript = {
          version: 5,
          onStateChange: sinon.spy(),
          onUpdateStatus: sinon.spy(),
          hydrate: sinon.stub().throws(),
          render: sinon.spy(),
          unmount: sinon.spy(),
        };

        const config = {
          apps: {
            APP_A: { appPath: '/app-a', fragments: ['ERROR_FRAGMENT', 'HEADER_FRAGMENT'] },
          },
          fragments: {
            ERROR_FRAGMENT: { slot: 'APP_SLOT', loadScript() { return errorScript; } },
            HEADER_FRAGMENT: { slot: 'HEADER_SLOT', loadScript() { return headerScript; } },
          },
          slots: {
            APP_SLOT: { querySelector: null },
            HEADER_SLOT: { querySelector: null },
          },
        };

        const stateChanger = appManager(config);

        await stateChanger({ resource: '/app-a' });

        expect(errorScript.onStateChange.callCount).to.equals(0);
        expect(errorScript.render.callCount).to.equals(0);
        expect(errorScript.hydrate.callCount).to.equals(1);
        expect(errorScript.unmount.callCount).to.equals(1);
        expect(errorScript.onUpdateStatus.callCount).to.equals(2);

        const [errorLoadingCall, errorErrorCall] = errorScript.onUpdateStatus.args;
        expect(errorLoadingCall[0].status).to.equals('LOADING');
        expect(errorErrorCall[0].status).to.equals('ERROR');

        expect(headerScript.onStateChange.callCount).to.equals(0);
        expect(headerScript.render.callCount).to.equals(0);
        expect(headerScript.hydrate.callCount).to.equals(1);
        expect(headerScript.unmount.callCount).to.equals(0);
        expect(headerScript.onUpdateStatus.callCount).to.equals(3);

        const [loadingCall, errorCall, defaultCall] = headerScript.onUpdateStatus.args;
        expect(loadingCall[0].status).to.equals('LOADING');
        expect(errorCall[0].status).to.equals('ERROR');
        expect(defaultCall[0].status).to.equals('DEFAULT');
      });
    });

    describe('update page', () => {
      it('handles errors on update', async () => {
        const headerScript = getSpyScript();

        const errorScript = {
          version: 5,
          onStateChange: sinon.stub().throws(),
          onUpdateStatus: sinon.spy(),
          hydrate: sinon.spy(),
          render: sinon.spy(),
          unmount: sinon.spy(),
        };

        const config = {
          apps: {
            APP_A: { appPath: '/app-a', fragments: ['APP_FRAGMENT', 'HEADER_FRAGMENT'] },
            APP_B: { appPath: '/app-b', fragments: ['ERROR_FRAGMENT', 'HEADER_FRAGMENT'] },
          },
          fragments: {
            APP_FRAGMENT: { slot: 'APP_SLOT', loadScript() { return errorScript; } },
            ERROR_FRAGMENT: { slot: 'APP_SLOT', loadScript() { return getSpyScript(); } },
            HEADER_FRAGMENT: { slot: 'HEADER_SLOT', loadScript() { return headerScript; } },
          },
          slots: {
            APP_SLOT: { querySelector: null },
            HEADER_SLOT: { querySelector: null },
          },
        };

        const stateChanger = appManager(config);

        await stateChanger({ resource: '/app-a' });

        await stateChanger({ resource: '/app-b' });

        expect(errorScript.onStateChange.callCount).to.equals(1);
        expect(errorScript.render.callCount).to.equals(0);
        expect(errorScript.hydrate.callCount).to.equals(1);
        expect(errorScript.unmount.callCount).to.equals(1);
        expect(errorScript.onUpdateStatus.callCount).to.equals(4);

        const [errorLoadingCall1, errorDefaultCall, errorLoadingCall2, errorErrorCall] = errorScript.onUpdateStatus.args;
        expect(errorLoadingCall1[0].status).to.equals('LOADING');
        expect(errorDefaultCall[0].status).to.equals('DEFAULT');
        expect(errorLoadingCall2[0].status).to.equals('LOADING');
        expect(errorErrorCall[0].status).to.equals('ERROR');

        expect(headerScript.onStateChange.callCount).to.equals(1);
        expect(headerScript.render.callCount).to.equals(0);
        expect(headerScript.hydrate.callCount).to.equals(1);
        expect(headerScript.unmount.callCount).to.equals(0);
        expect(headerScript.onUpdateStatus.callCount).to.equals(5);

        const [loadingCall1, defaultCall1, loadingCall2, errorCall, defaultCall2] = headerScript.onUpdateStatus.args;
        expect(loadingCall1[0].status).to.equals('LOADING');
        expect(defaultCall1[0].status).to.equals('DEFAULT');
        expect(loadingCall2[0].status).to.equals('LOADING');
        expect(errorCall[0].status).to.equals('ERROR');
        expect(defaultCall2[0].status).to.equals('DEFAULT');
      });
    });
  });
});
