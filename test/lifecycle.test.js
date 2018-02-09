// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import type { ScriptType } from '../lib/index';

import WindowStub from '../lib/utils/window-stub';
import initLifecycle from '../lib/utils/lifecycle';

describe('Lifecycle', () => {
  const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);
  const options = { importTimeout: 50 };

  const state = {
    event: null,
    path: '/',
    prevApp: { name: 'PrevApp' },
    app: { name: 'App' },
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

  function getConfig(appScript: ScriptType, headerScript: ScriptType, footerScript: ScriptType) {
    return {
      slots: {
        APP: { querySelector: '.fragment' },
        HEADER: { querySelector: '.header' },
        FOOTER: { querySelector: '.footer' },
      },
      fragments: {
        APP: { slot: 'APP', loadScript: async () => appScript },
        HEADER: { slot: 'HEADER', loadScript: async () => headerScript },
        FOOTER: { slot: 'FOOTER', loadScript: async () => footerScript },
      },
      apps: {},
    };
  }

  describe('setup page', () => {
    it('hydrates a script with no errors', async () => {
      const appScript = getSpyScript();
      const config = getConfig(appScript, getSpyScript(), getSpyScript());
      const lifecycle = initLifecycle(windowStub, config, options);

      await lifecycle.mountSlot(state, 'APP', 'APP', true);

      expect(appScript.onStateChange.callCount).to.equals(0);
      expect(appScript.render.callCount).to.equals(0);
      expect(appScript.hydrate.callCount).to.equals(1);
      expect(appScript.unmount.callCount).to.equals(0);
      expect(appScript.onUpdateStatus.callCount).to.equals(2);
    });

    it('handles errors on hydrate', async () => {
      const errorScript = {
        version: 5,
        onStateChange: sinon.spy(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.stub().throws(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };

      const headerScript = getSpyScript();
      const appScript = getSpyScript();

      const config = getConfig(appScript, headerScript, getSpyScript());
      const lifecycle = initLifecycle(windowStub, config, options);

      await lifecycle.mountSlot(state, 'APP', 'APP', true);

      expect(errorScript.onStateChange.callCount).to.equals(0);
      expect(errorScript.render.callCount).to.equals(0);
      expect(errorScript.hydrate.callCount).to.equals(1);
      expect(errorScript.unmount.callCount).to.equals(0);
      expect(errorScript.onUpdateStatus.callCount).to.equals(1);

      expect(headerScript.onStateChange.callCount).to.equals(0);
      expect(headerScript.render.callCount).to.equals(0);
      expect(headerScript.hydrate.callCount).to.equals(1);
      expect(headerScript.unmount.callCount).to.equals(0);
      expect(headerScript.onUpdateStatus.callCount).to.equals(3);
    });
  });

  describe('update page', () => {
    it('handles errors on update', async () => {
      const errorScript = {
        version: 5,
        onStateChange: sinon.stub().throws(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.spy(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };

      const headerScript = getSpyScript();
      const appScript = getSpyScript();

      const config = getConfig(appScript, headerScript, getSpyScript());
      const lifecycle = initLifecycle(windowStub, config, options);

      await lifecycle.updateSlot(state, 'APP');

      expect(state.app.name).to.equals('APP');

      expect(errorScript.onStateChange.callCount).to.equals(1);
      expect(errorScript.render.callCount).to.equals(0);
      expect(errorScript.hydrate.callCount).to.equals(1);
      expect(errorScript.unmount.callCount).to.equals(0);
      expect(errorScript.onUpdateStatus.callCount).to.equals(3);

      expect(headerScript.onStateChange.callCount).to.equals(1);
      expect(headerScript.render.callCount).to.equals(0);
      expect(headerScript.hydrate.callCount).to.equals(1);
      expect(headerScript.unmount.callCount).to.equals(0);
      expect(headerScript.onUpdateStatus.callCount).to.equals(5);
    });
  });
});
