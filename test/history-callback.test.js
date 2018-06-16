// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'eventemitter3';
import WindowStub, { windowEventTitles } from 'window-stub';

import { eventTitles } from '../lib/constants';
import initHistoryCallback from '../lib/history-callback';
import { awaitEvent } from './utils';

describe('history-callback', () => {
  describe('history methods', () => {
    const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);

    const historyCallback = initHistoryCallback(windowStub);
    const events = new EventEmitter();

    const callback = sinon.stub();

    let stateChanger;

    before(async () => {
      stateChanger = await historyCallback(callback, events);
    });

    after(() => {
      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('correctly initialises', async () => {
      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][1]).to.deep.equals({
        title: null,
        resource: '/a',
        eventTitle: eventTitles.INITIALISE,
        rootState: true,
        historyState: null,
      });
    });

    it('pushState', async () => {
      windowStub.history.pushState(null, null, '/b');

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(2);
      expect(callback.args[1][1]).to.deep.equals({
        title: null,
        resource: '/b',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        rootState: true,
        historyState: null,
      });
    });

    it('back', async () => {
      windowStub.history.back();

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(3);
      expect(callback.args[2][1]).to.deep.equals({
        title: null,
        resource: '/a',
        eventTitle: eventTitles.HISTORY_POP_STATE,
        rootState: true,
        historyState: null,
      });
    });

    it('forward', async () => {
      windowStub.history.forward();

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(4);
      expect(callback.args[3][1]).to.deep.equals({
        title: null,
        resource: '/b',
        eventTitle: eventTitles.HISTORY_POP_STATE,
        rootState: true,
        historyState: null,
      });
    });

    it('replaceState', async () => {
      windowStub.history.replaceState(null, null, '/c');

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(5);
      expect(callback.args[4][1]).to.deep.equals({
        title: null,
        resource: '/c',
        eventTitle: eventTitles.HISTORY_REPLACE_STATE,
        rootState: true,
        historyState: null,
      });
    });

    it('go', async () => {
      windowStub.history.go(-1);

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(6);
      expect(callback.args[5][1]).to.deep.equals({
        title: null,
        resource: '/a',
        eventTitle: eventTitles.HISTORY_POP_STATE,
        rootState: true,
        historyState: null,
      });
    });
  });

  describe('events', () => {
    it('calling replaceState emits correct events', () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);
      const historyCallback = initHistoryCallback(windowStub);
      const callback = sinon.stub().returns(true);

      const events = new EventEmitter();

      const replaceStateSpy = sinon.spy();
      const stateChangeSpy = sinon.spy();

      events.on(eventTitles.HISTORY_REPLACE_STATE, replaceStateSpy);
      events.on(eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

      historyCallback(callback, events);

      windowStub.history.replaceState(null, null, '/b');

      expect(replaceStateSpy.calledOnce).to.be.true;
      expect(stateChangeSpy.calledOnce).to.be.true;

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('resets the history functions before unloading', () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);

      const beforeunloadSpy = sinon.spy();
      const pushStateSpy = sinon.spy();
      const stateChangeSpy = sinon.spy();
      const callback = sinon.stub().returns(true);

      windowStub.onbeforeunload = beforeunloadSpy;

      const historyCallback = initHistoryCallback(windowStub);

      const events = new EventEmitter();

      events.on(eventTitles.HISTORY_PUSH_STATE, pushStateSpy);
      events.on(eventTitles.HISTORY_STATE_CHANGE, stateChangeSpy);

      historyCallback(callback, events);

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
      expect(beforeunloadSpy.calledOnce).to.be.true;

      windowStub.history.pushState(null, null, '/c');

      expect(pushStateSpy.called).to.be.false;
      expect(stateChangeSpy.called).to.be.false;

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });
  });

  describe('Queueing state changes', () => {
    it('runs the init state changer and resets afterwards', async () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);
      const historyCallback = initHistoryCallback(windowStub);

      const callback = sinon.stub();

      const events = new EventEmitter();

      const stateChanger = historyCallback(callback, events);

      const { runningStateChange } = stateChanger;

      expect(runningStateChange).to.be.a('promise');

      const result = await runningStateChange;

      expect(result).to.be.undefined;

      expect(stateChanger.runningStateChange).to.be.null;

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('skips over queued state changes if the state changes again while a state change is already in progress', async () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);
      const historyCallback = initHistoryCallback(windowStub);

      const callback = sinon.stub().returns(true).onThirdCall().returns((async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return true;
      })());

      const events = new EventEmitter();

      const stateChanger = await historyCallback(callback, events);

      await stateChanger.runningStateChange;

      expect(callback.callCount).to.equal(1);
      expect(callback.args[0][1]).to.deep.equals({
        title: null,
        resource: '/a',
        eventTitle: eventTitles.INITIALISE,
        rootState: true,
        historyState: null,
      });

      windowStub.history.pushState(null, null, '/b');
      windowStub.history.pushState(null, null, '/c');
      windowStub.history.pushState(null, null, '/d');

      expect(callback.callCount).to.equal(2);
      expect(callback.args[1][1]).to.deep.equals({
        title: null,
        resource: '/b',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        rootState: true,
        historyState: null,
      });

      const firstRunningStateChange = stateChanger.runningStateChange;

      expect(firstRunningStateChange).to.be.a('promise');

      await firstRunningStateChange;

      expect(callback.callCount).to.equal(3);
      expect(callback.args[2][1]).to.deep.equals({
        title: null,
        resource: '/d',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        rootState: true,
        historyState: null,
      });

      const secondRunningStateChange = stateChanger.runningStateChange;

      expect(secondRunningStateChange).to.be.a('promise');

      await secondRunningStateChange;

      expect(stateChanger.runningStateChange).to.be.null;

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });

    it('propagates errors and tries to continue if a state change fails', async () => {
      const windowStub = new WindowStub([{ data: null, title: null, url: '/a' }]);
      const historyCallback = initHistoryCallback(windowStub);

      const callback = sinon.stub().onSecondCall().returns(Promise.reject(new Error('Nope')));

      const events = new EventEmitter();

      const stateChanger = await historyCallback(callback, events);

      await stateChanger.runningStateChange;

      windowStub.history.pushState(null, null, '/b');

      const firstRunningStateChange = stateChanger.runningStateChange;

      expect(firstRunningStateChange).to.be.a('promise');

      const [err]: any = await awaitEvent(events, eventTitles.ERROR);

      expect(err.message).to.contain('Nope');

      await firstRunningStateChange;

      windowStub.history.pushState(null, null, '/c');

      const secondRunningStateChange = stateChanger.runningStateChange;

      expect(secondRunningStateChange).to.be.a('promise');

      await secondRunningStateChange;

      expect(callback.callCount).to.equal(3);
      expect(callback.args[2][1]).to.deep.equals({
        title: null,
        resource: '/c',
        eventTitle: eventTitles.HISTORY_PUSH_STATE,
        rootState: true,
        historyState: null,
      });

      expect(stateChanger.runningStateChange).to.be.null;

      windowStub._events.emit(windowEventTitles.WINDOW_BEFORE_UNLOAD);
    });
  });
});
