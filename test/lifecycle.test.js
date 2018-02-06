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

  function getConfig(loadScriptApp = async () => getSpyScript(), loadScriptHeader = async () => getSpyScript()) {
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
        APP: { slots: ['APP'], loadScript: loadScriptApp },
        HEADER: { slots: ['HEADER'], loadScript: loadScriptHeader },
        FOOTER: { slots: ['FOOTER'], loadScript: async () => getSpyScript() },
      },
    };
  }

  describe('setup page', () => {
    it('hydrates a script with no errors', async () => {
      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const AppManager = initAppManager(windowStub);

      const appManager = new AppManager(getConfig(), new EventEmitter());

      appManager.init();

      await appManager._runningStateChange;

      expect(appManager._currentAppName).to.equals(appManager._apps.APP.name);

      expect(appManager._cachedScripts).to.have.keys(['APP', 'HEADER', 'FOOTER']);

      const appScript: any = appManager._cachedScripts.APP;

      expect(appScript.onStateChange.callCount).to.equals(0);
      expect(appScript.render.callCount).to.equals(0);
      expect(appScript.hydrate.callCount).to.equals(1);
      expect(appScript.unmount.callCount).to.equals(0);
      expect(appScript.onUpdateStatus.callCount).to.equals(4);
    });

    it('handles errors on hydrate', async () => {
      const windowStub = new WindowStub([{ data: {}, title: null, url: '/app-a' }]);

      const AppManager = initAppManager(windowStub);

      const errorScript = {
        version: 5,
        onStateChange: sinon.spy(),
        onUpdateStatus: sinon.spy(),
        hydrate: sinon.stub().throws(),
        render: sinon.spy(),
        unmount: sinon.spy(),
      };

      const config = getConfig(
        async () => errorScript,
        async () => { throw new Error('Nope.'); },
      );

      const appManager = new AppManager(config, new EventEmitter());

      appManager.init();

      await appManager._runningStateChange;

      expect(appManager._currentAppName).to.equals(appManager._apps.APP.name);

      expect(appManager._cachedScripts).to.have.keys(['APP', 'FOOTER']);

      const appScript: any = appManager._cachedScripts.APP;

      expect(appScript.onStateChange.callCount).to.equals(0);
      expect(appScript.render.callCount).to.equals(0);
      expect(appScript.hydrate.callCount).to.equals(1);
      expect(appScript.unmount.callCount).to.equals(0);
      expect(appScript.onUpdateStatus.callCount).to.equals(4);

      const footerScript: any = appManager._cachedScripts.FOOTER;

      expect(footerScript.onStateChange.callCount).to.equals(0);
      expect(footerScript.render.callCount).to.equals(0);
      expect(footerScript.hydrate.callCount).to.equals(1);
      expect(footerScript.unmount.callCount).to.equals(0);
      expect(footerScript.onUpdateStatus.callCount).to.equals(6);
    });
  });
});
