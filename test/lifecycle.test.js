// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'eventemitter3'; // eslint-disable-line import/no-extraneous-dependencies

import WindowStub from '../lib/utils/window-stub';
import initAppManager from '../lib/app-manager';

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

  function getConfig(loadScriptApp, loadScriptHeader, loadScriptFooter) {
    const defaultLoadScript = async () => getSpyScript();

    return {
      apps: {
        APP: { appPath: '/app-a', fragments: ['APP', 'HEADER', 'FOOTER'] },
      },
      slots: {
        APP: { querySelector: '.fragment' },
        HEADER: { querySelector: '.header' },
        FOOTER: { querySelector: '.footer' },
      },
      fragments: {
        APP: { slot: 'APP', loadScript: loadScriptApp || defaultLoadScript },
        HEADER: { slot: 'HEADER', loadScript: loadScriptHeader || defaultLoadScript },
        FOOTER: { slot: 'FOOTER', loadScript: loadScriptFooter || defaultLoadScript },
      },
    };
  }

  describe('setup page', () => {
    it('hydrates a script with no errors', async () => {
      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const appManager = initAppManager(windowStub);

      const appScript = getSpyScript();

      const config = getConfig(async () => appScript);

      const { getState, getRunningStateChange } = appManager(config, new EventEmitter());

      await getRunningStateChange();

      const state = getState();

      expect(state.app.name).to.equals('APP');

      expect(appScript.onStateChange.callCount).to.equals(0);
      expect(appScript.render.callCount).to.equals(0);
      expect(appScript.hydrate.callCount).to.equals(1);
      expect(appScript.unmount.callCount).to.equals(0);
      expect(appScript.onUpdateStatus.callCount).to.equals(2);
    });

    it('handles errors on hydrate', async () => {
      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const appManager = initAppManager(windowStub);

      const errorScript = {
        version: 5,
        onStateChange: sinon.spy(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.stub().throws(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };

      const headerScript = getSpyScript();

      const config = getConfig(async () => errorScript, async () => headerScript);

      const { getState, getRunningStateChange } = appManager(config, new EventEmitter());

      await getRunningStateChange();

      const state = getState();

      expect(state.app.name).to.equals('APP');

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
      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const errorScript = {
        version: 5,
        onStateChange: sinon.stub().throws(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.spy(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };

      const headerScript = getSpyScript();

      const appManager = initAppManager(windowStub);

      const config = getConfig(async () => errorScript, headerScript);

      const { getState, getRunningStateChange } = appManager(config, new EventEmitter());

      await getRunningStateChange();

      windowStub.history.pushState(null, null, '/app-a');

      await getRunningStateChange();

      const state = getState();

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
