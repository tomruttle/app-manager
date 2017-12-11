// @flow

import EventEmitter from 'eventemitter3';
import URL from 'url-parse';

import { eventTitles } from '../constants';

type StateEntry = { data: Object, title: ?string, hash: string };

export default class WindowStub {
  location: *;
  _state: Array<StateEntry>;
  _position: number;

  constructor(initialHistoryState: Array<StateEntry> = [{ data: {}, title: null, hash: '/' }]) {
    const isInitialState = Array.isArray(initialHistoryState) && initialHistoryState.length > 0;

    this._position = isInitialState ? initialHistoryState.length - 1 : 0;
    this._state = [...initialHistoryState];

    const initialPath = isInitialState ? initialHistoryState[initialHistoryState.length - 1].hash : '/';
    const initialTitle = isInitialState ? initialHistoryState[initialHistoryState.length - 1].title : null;
    this._updateLocation(initialPath, initialTitle);
  }

  _events = new EventEmitter();

  _onpopstatecb: ?() => mixed = null;

  _onbeforeunloadecb: ?() => mixed = null;

  _updateLocation(path: string, title: ?string) {
    const parsed = new URL(path);

    this.location = {
      href: parsed.href,
      pathname: parsed.pathname,
      title,
    };
  }

  set onpopstate(callback: mixed) {
    if (typeof callback !== 'function') {
      this._events.removeListener(eventTitles.HISTORY_POP_STATE, this._onpopstatecb);
      return;
    }

    this._onpopstatecb = callback;
    this._events.on(eventTitles.HISTORY_POP_STATE, this._onpopstatecb);
  }

  set onbeforeunload(callback: mixed) {
    if (typeof callback !== 'function') {
      this._events.removeListener(eventTitles.WINDOW_BEFORE_UNLOAD, this._onbeforeunloadecb);
      return;
    }

    this._onbeforeunloadecb = callback;
    this._events.on(eventTitles.WINDOW_BEFORE_UNLOAD, this._onbeforeunloadecb);
  }

  document = {
    querySelector(selector: string): Element {
      return (selector: any);
    },
  }

  history = {
    get length() { return this._state.length; },

    get state() { return (this._state[this._position] || {}).data; },

    replaceState: (data: ?{}, title: ?string, href: string) => {
      const { data: currentData, title: currentTitle, hash: currentUrl } = this._state[this._position];
      const newHash = href || currentUrl;
      const newTitle = title || currentTitle;

      const newState = {
        data: data || currentData,
        title: newTitle,
        hash: newHash,
      };

      this._state = [...this._state.slice(0, this._position), newState];
      this._updateLocation(newHash, newTitle);
    },

    pushState: (data: ?{}, title: ?string, href: string) => {
      const { data: currentData, title: currentTitle, hash: currentUrl } = this._state[this._position];
      const newHash = href || currentUrl;
      const newTitle = title || currentTitle;

      const newState = {
        data: data || currentData,
        title: newTitle,
        hash: newHash,
      };

      this._state = [...this._state.slice(0, this._position + 1), newState];
      this._position = this._position + 1;
      this._updateLocation(newHash, newTitle);
    },

    back: () => {
      this._position = this._position - 1;

      const newState = this._state[this._position];

      this._updateLocation(newState.hash, newState.title);
      this._events.emit(eventTitles.HISTORY_POP_STATE, newState);
    },

    forward: () => {
      if (this._state[this._position + 1]) {
        this._position = this._position + 1;

        const newState = this._state[this._position];

        this._updateLocation(newState.hash, newState.title);
        this._events.emit(eventTitles.HISTORY_POP_STATE, newState);
      }
    },

    go: (relativeIndex: number) => {
      const newPosition = this._position + relativeIndex;

      if (this._state[newPosition]) {
        this._position = newPosition;

        const newState = this._state[this._position];

        this._updateLocation(newState.hash, newState.title);
        this._events.emit(eventTitles.HISTORY_POP_STATE, newState);
      }
    },
  }
}
