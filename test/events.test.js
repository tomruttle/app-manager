// @flow

import { expect } from 'chai';
import EventEmitter from 'eventemitter3';
import sinon from 'sinon';

import WindowStub from '../lib/utils/window-stub';

import initAppManager from '../lib/app-manager';

describe('events', () => {
  function waitForIO() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  it('Can bind and unbind event listeners', async () => {
    let errorTitle;

    const apps = {
      APP_A: {
        name: 'APP_A',
        appPath: '/app-a/:entityId?',
        fragments: ['SCRIPT_A'],
      },
    };

    const config = {
      apps,
      slots: {},
      fragments: {},
    };

    const windowStub = new WindowStub([{ data: {}, title: null, hash: '/app-a' }]);

    const AppManager = initAppManager(windowStub);

    const appManager = new AppManager(config, new EventEmitter());

    function errorListener(data) {
      if (data && data.title) {
        errorTitle = data.title;
      }
    }

    appManager.on('am-error', errorListener);

    expect(appManager._status).to.equals('DEFAULT');

    windowStub.history.pushState({}, null, '/app-b');

    await waitForIO();

    const success = await appManager.init();

    expect(success).to.be.false;
    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    expect(errorTitle).to.equals('init.no_route');

    windowStub.history.pushState({}, null, '/app-a');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');

    appManager.removeListener('am-error', errorListener);

    windowStub.history.pushState(null, null, '/app-c');

    await waitForIO();

    expect(appManager._currentAppName).to.be.null;
    expect(appManager._status).to.equals('ERROR');
  });

  it('calling replaceState emits correct events', () => {
    const windowStub = new WindowStub([{ data: {}, title: null, hash: '/app-a' }]);
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
    const windowStub = new WindowStub([{ data: {}, title: null, hash: '/app-a' }]);

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
});
