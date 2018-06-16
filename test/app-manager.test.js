// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import WindowStub from 'window-stub';
import EventEmitter from 'eventemitter3';

import getAppManagerCallback, { appManager, getAppManagerScript } from '../lib/app-manager';
import { eventTitles } from '../lib/constants';
import { defaultGetRouteNameFromResource } from '../lib/utils/config';

describe('app-manager', () => {
  const windowStub = new WindowStub();

  const options = {
    importTimeout: 20,
    async getElement() { return (true: any); },
    async getAdditionalState() { return { additional: 'state' }; },
  };

  describe('multi-step browser test', () => {
    const mockA = {
      version: 4,
      hydrate: sinon.spy(),
      mount: sinon.spy(),
      onStateChange: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      unmount: sinon.spy(),
    };

    const mockB = {
      version: 5,
      hydrate: sinon.spy(),
      render: sinon.spy(),
      onStateChange: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      unmount: sinon.spy(),
    };

    const mockC = {
      version: 6,
      hydrate: sinon.spy(),
      render: sinon.spy(),
      onStateChange: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      unmount: sinon.spy(),
    };

    const config = {
      routes: {
        APP_A: { name: 'APP_A', path: '/app-a', fragment: 'SCRIPT_A' },
        APP_B: { name: 'APP_A', paths: ['/app-b', '/app-b/next'], fragment: 'SCRIPT_B' },
        APP_C: { name: 'APP_A', path: '/app-c', fragment: 'SCRIPT_C' },
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

    let script;

    before(() => {
      script = getAppManagerScript(config, null, { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });
    });

    it('correctly initialises app manager with first fragment', async () => {
      await script.render(windowStub.document, {
        resource: '/app-a',
        eventTitle: eventTitles.INITIALISE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_A');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(0);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(0);
      expect(mockA.onUpdateStatus.callCount).to.equals(2);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(0);
      expect(mockB.onStateChange.callCount).to.equals(0);
      expect(mockB.unmount.callCount).to.equals(0);
      expect(mockB.onUpdateStatus.callCount).to.equals(0);
    });

    it('browses to new route', async () => {
      await script.onStateChange(windowStub.document, {
        resource: '/app-b',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_B');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(0);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(1);
      expect(mockA.onUpdateStatus.callCount).to.equals(4);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(1);
      expect(mockB.onStateChange.callCount).to.equals(0);
      expect(mockB.unmount.callCount).to.equals(0);
      expect(mockB.onUpdateStatus.callCount).to.equals(2);
    });

    it('moves within a route', async () => {
      await script.onStateChange(windowStub.document, {
        resource: '/app-b/next',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_B');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(0);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(1);
      expect(mockA.onUpdateStatus.callCount).to.equals(4);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(1);
      expect(mockB.onStateChange.callCount).to.equals(1);
      expect(mockB.unmount.callCount).to.equals(0);
      expect(mockB.onUpdateStatus.callCount).to.equals(4);
    });

    it('moves back within a route', async () => {
      await script.onStateChange(windowStub.document, {
        resource: '/app-b',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_B');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(0);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(1);
      expect(mockA.onUpdateStatus.callCount).to.equals(4);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(1);
      expect(mockB.onStateChange.callCount).to.equals(2);
      expect(mockB.unmount.callCount).to.equals(0);
      expect(mockB.onUpdateStatus.callCount).to.equals(6);
    });

    it('moves back to the old route', async () => {
      await script.onStateChange(windowStub.document, {
        resource: '/app-a',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_A');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(1);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(1);
      expect(mockA.onUpdateStatus.callCount).to.equals(6);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(1);
      expect(mockB.onStateChange.callCount).to.equals(2);
      expect(mockB.unmount.callCount).to.equals(1);
      expect(mockB.onUpdateStatus.callCount).to.equals(8);
    });

    it('moves forward again', async () => {
      await script.onStateChange(windowStub.document, {
        resource: '/app-b',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      if (!script.state.route) {
        throw new Error('Expected route to be set.');
      }

      expect(script.state.route.name).to.equals('APP_B');

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(1);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(2);
      expect(mockA.onUpdateStatus.callCount).to.equals(8);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(2);
      expect(mockB.onStateChange.callCount).to.equals(2);
      expect(mockB.unmount.callCount).to.equals(1);
      expect(mockB.onUpdateStatus.callCount).to.equals(10);
    });

    it('Unmounts all scripts on exit', async () => {
      await script.unmount(windowStub.document, {
        resource: '/app-d',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        historyState: null,
        title: null,
        rootState: true,
      });

      expect(script.state.route).to.be.null;

      expect(mockA.hydrate.callCount).to.equals(1);
      expect(mockA.mount.callCount).to.equals(1);
      expect(mockA.onStateChange.callCount).to.equals(0);
      expect(mockA.unmount.callCount).to.equals(2);
      expect(mockA.onUpdateStatus.callCount).to.equals(8);

      expect(mockB.hydrate.callCount).to.equals(0);
      expect(mockB.render.callCount).to.equals(2);
      expect(mockB.onStateChange.callCount).to.equals(2);
      expect(mockB.unmount.callCount).to.equals(2);
      expect(mockB.onUpdateStatus.callCount).to.equals(12);

      expect(mockC.hydrate.callCount).to.equals(0);
      expect(mockC.render.callCount).to.equals(0);
      expect(mockC.onStateChange.callCount).to.equals(0);
      expect(mockC.unmount.callCount).to.equals(0);
      expect(mockC.onUpdateStatus.callCount).to.equals(0);
    });

    it('Expect there to have been no errors', () => {
      expect(onError.called).to.be.false;
    });
  });

  describe('errors', () => {
    it('emits an error event if route tries to load missing fragment', async () => {
      const config = {
        routes: {
          APP_A: { name: 'APP_A', path: '/app-a', fragment: 'MISSING' },
        },
        fragments: {},
        slots: {},
      };

      const script = getAppManagerScript(config, null, { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

      try {
        await script.render(windowStub.document, {
          resource: '/app-a',
          route: config.routes.APP_A,
          prevRoute: null,
          eventTitle: eventTitles.INITIALISE,
        });

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
          routes: {
            APP_A: { name: 'APP_A', path: '/app-a', fragment: 'SCRIPT_A' },
          },
          fragments: {
            SCRIPT_A: { slot: 'MAIN', loadScript() { return appScript; } },
          },
          slots: {
            MAIN: { querySelector: '.app' },
          },
        };

        const script = getAppManagerScript(config, null, { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

        await script.render(windowStub.document, {
          resource: '/app-a',
          route: config.routes.APP_A,
          prevRoute: null,
          eventTitle: eventTitles.INITIALISE,
        });

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
          routes: {
            APP_A: { name: 'APP_A', path: '/app-a', fragments: ['ERROR_FRAGMENT', 'HEADER_FRAGMENT'] },
          },
          fragments: {
            ERROR_FRAGMENT: { slot: 'APP_SLOT', loadScript() { return errorScript; } },
            HEADER_FRAGMENT: { slot: 'HEADER_SLOT', loadScript() { return headerScript; } },
          },
          slots: {
            APP_SLOT: { querySelector: '.app' },
            HEADER_SLOT: { querySelector: '.header' },
          },
        };

        const script = getAppManagerScript(config, new EventEmitter(), { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

        await script.render(windowStub.document, {
          resource: '/app-a',
          route: config.routes.APP_A,
          prevRoute: null,
          eventTitle: eventTitles.INITIALISE,
        });

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
          routes: {
            APP_A: { name: 'APP_A', paths: ['/app-a', '/app-b'], fragments: ['ERROR_FRAGMENT', 'HEADER_FRAGMENT'] },
          },
          fragments: {
            ERROR_FRAGMENT: { slot: 'APP_SLOT', loadScript() { return errorScript; } },
            HEADER_FRAGMENT: { slot: 'HEADER_SLOT', loadScript() { return headerScript; } },
          },
          slots: {
            APP_SLOT: { querySelector: '.app' },
            HEADER_SLOT: { querySelector: '.header' },
          },
        };

        const script = getAppManagerScript(config, new EventEmitter(), { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

        await script.render(windowStub.document, {
          resource: '/app-a',
          route: config.routes.APP_A,
          prevRoute: null,
          eventTitle: eventTitles.INITIALISE,
        });

        await script.onStateChange(windowStub.document, {
          resource: '/app-b',
          route: config.routes.APP_A,
          prevRoute: config.routes.APP_A,
          eventTitle: eventTitles.HISTORY_PUSH_STATE,
        });

        expect(errorScript.render.callCount).to.equals(0);
        expect(errorScript.hydrate.callCount).to.equals(1);
        expect(errorScript.onStateChange.callCount).to.equals(1);
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

      it('throws error if attempting to browse to fragment with no loadScript', async () => {
        const spyScript = getSpyScript();

        const config = {
          routes: {
            APP_A: { name: 'APP_A', path: '/app-a', fragment: 'FRAGMENT' },
            APP_B: { name: 'APP_B', path: '/app-b', fragment: 'ERROR_FRAGMENT' },
          },
          fragments: {
            ERROR_FRAGMENT: { slot: 'APP_SLOT' },
            FRAGMENT: { slot: 'APP_SLOT', loadScript() { return spyScript; } },
          },
          slots: {
            APP_SLOT: { querySelector: '.app' },
          },
        };

        const script = getAppManagerScript(config, null, { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

        await script.hydrate(windowStub.document, {
          resource: '/app-a',
          eventTitle: eventTitles.INITIALISE,
          historyState: null,
          title: null,
          rootState: true,
        });

        try {
          await script.onStateChange(windowStub.document, {
            resource: '/app-b',
            eventTitle: eventTitles.HISTORY_PUSH_STATE,
            historyState: null,
            title: null,
            rootState: true,
          });

          throw new Error('Should not get here.');
        } catch (err) {
          expect(err.code).to.equal('get_script');
        }
      });

      it('handles updating a hydrated fragment with no loadScript', async () => {
        const config = {
          routes: {
            APP_A: { name: 'APP_A', paths: ['/app-a', '/app-b'], fragment: 'ERROR_FRAGMENT' },
          },
          fragments: {
            ERROR_FRAGMENT: { slot: 'APP_SLOT' },
          },
          slots: {
            APP_SLOT: { querySelector: '.app' },
          },
        };

        const script = getAppManagerScript(config, null, { ...options, getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes) });

        await script.hydrate(windowStub.document, {
          resource: '/app-a',
          eventTitle: eventTitles.INITIALISE,
          historyState: null,
          title: null,
          rootState: true,
        });

        await script.onStateChange(windowStub.document, {
          resource: '/app-b',
          eventTitle: eventTitles.HISTORY_PUSH_STATE,
          historyState: null,
          title: null,
          rootState: true,
        });
      });
    });
  });

  describe('appManager', () => {
    it('Exports a ScriptType script', () => {
      const config = { fragments: {}, routes: {}, slots: {} };
      const events = new EventEmitter();
      const script = appManager(config, events, options);

      expect(script).to.have.all.keys('hydrate', 'render', 'unmount', 'onStateChange', 'onUpdateStatus', 'version');
    });
  });

  describe('getAppManagerCallback', () => {
    it('Wraps appManager in a callback', async () => {
      const config = {
        routes: { APP_A: { path: '/app-a' }, APP_B: { path: '/app-b' } },
        fragments: {},
        slots: {},
      };

      const events = new EventEmitter();
      const appManagerCallback = getAppManagerCallback(config, events, options);

      const initResult = await appManagerCallback((true: any), {
        rootState: true,
        resource: '/app-a',
        historyState: null,
        eventTitle: eventTitles.INITIALISE,
        title: null,
      });

      expect(initResult).to.be.undefined;

      const updateResult = await appManagerCallback((true: any), {
        rootState: true,
        resource: '/app-b',
        historyState: null,
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        title: null,
      });

      expect(updateResult).to.be.undefined;
    });
  });
});
