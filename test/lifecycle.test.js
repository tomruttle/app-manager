// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import initLifecycle from '../lib/utils/lifecycle';

describe('Lifecycle', () => {
  const options = { importTimeout: 50, domCheckInterval: 1 };

  const windowStub = {
    document: {
      querySelector() { return (true: any); },
    },
  };

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
      const fragments = { APP_FRAGMENT: { slot: 'APP_SLOT' } };
      const slots = {};

      async function loadScript(slotName) {
        return slotName === 'APP_SLOT' ? appScript : getSpyScript();
      }

      const lifecycle = initLifecycle(windowStub, fragments, slots, loadScript, options);

      await lifecycle({
        mount: { APP_SLOT: 'APP_FRAGMENT' },
        unmount: {},
        update: {},
      }, true);

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

      const fragments = {
        APP_FRAGMENT: { slot: 'APP_SLOT' },
        HEADER_FRAGMENT: { slot: 'HEADER_SLOT' },
      };

      const slots = {};

      async function loadScript(slotName) {
        return slotName === 'APP_SLOT' ? errorScript : headerScript;
      }

      const lifecycle = initLifecycle(windowStub, fragments, slots, loadScript, options);

      await lifecycle({
        mount: { APP_SLOT: 'APP_FRAGMENT', HEADER_SLOT: 'HEADER_FRAGMENT' },
        unmount: {},
        update: {},
      }, true);

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

      const fragments = {
        APP_FRAGMENT: { slot: 'APP_SLOT' },
        HEADER_FRAGMENT: { slot: 'HEADER_FRAGMENT' },
      };

      const slots = {};

      async function loadScript(slotName) {
        return slotName === 'APP_SLOT' ? errorScript : headerScript;
      }

      const lifecycle = initLifecycle(windowStub, fragments, slots, loadScript, options);

      await lifecycle({
        mount: { APP_SLOT: 'APP_FRAGMENT', HEADER_SLOT: 'HEADER_FRAGMENT' },
        update: {},
        unmount: {},
      }, true);

      await lifecycle({
        mount: {},
        unmount: {},
        update: { APP_SLOT: 'APP_FRAGMENT', HEADER_SLOT: 'HEADER_FRAGMENT' },
      }, false);

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
