// @flow

import EventEmitter from 'eventemitter3';

import { eventTitles } from '../constants';

type StateEntry = { data: Object, title: ?string, hash: string };

class History {
  _state: Array<StateEntry>;
  _position: number;
  _events: *;

  constructor(events: EventEmitter, state: Array<StateEntry>) {
    this._position = state.length === 0 ? 0 : state.length - 1;
    this._state = [...state];

    this._events = events;
  }

  get state() { return this._state[this._position]; }

  replaceState = (data: ?{}, title: ?string, href: string) => {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this._state[this._position];

    const newState = {
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    };

    this._state = [...this._state.slice(0, this._position), newState];
  };

  pushState = (data: ?{}, title: ?string, href: string) => {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this._state[this._position];

    const newState = {
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    };

    this._state = [...this._state.slice(0, this._position + 1), newState];

    this._position = this._position + 1;
  };

  back() {
    this._position = this._position - 1;
    this._events.emit(eventTitles.HISTORY_POP_STATE, this._state[this._position]);
  }

  forward() {
    if (this._state[this._position + 1]) {
      this._position = this._position + 1;
      this._events.emit(eventTitles.HISTORY_POP_STATE, this._state[this._position]);
    }
  }

  go(relativeIndex: number) {
    const newPosition = this._position + relativeIndex;

    if (this._state[newPosition]) {
      this._position = newPosition;
      this._events.emit(eventTitles.HISTORY_POP_STATE, this._state[this._position]);
    }
  }
}

export default class WindowStub {
  document: *;
  location: *;
  history: History;
  _onpopstatecb: ?() => mixed;
  _onbeforeunloadecb: ?() => mixed;
  _events: EventEmitter;

  constructor(initialHistoryState: Array<StateEntry> = [{ data: {}, title: null, hash: '/' }]) {
    const initialPath = Array.isArray(initialHistoryState) && initialHistoryState.length > 0
      ? initialHistoryState[initialHistoryState.length - 1].hash
      : '/';

    this.location = {
      href: `http://address/${initialPath}`,
      pathname: initialPath,
      search: '',
    };

    this.document = {
      referrer: 'http://referrer1',

      querySelector() { return true; },
    };

    const ee = new EventEmitter();

    this._events = ee;
    this._onpopstatecb = null;
    this._onbeforeunloadecb = null;

    this.history = new History(ee, initialHistoryState);
  }

  set onpopstate(callback: mixed) {
    if (typeof callback === 'function') {
      this._onpopstatecb = callback;
      this._events.on(eventTitles.HISTORY_POP_STATE, this._onpopstatecb);
    } else {
      this._events.removeListener(eventTitles.HISTORY_POP_STATE, this._onpopstatecb);
    }
  }

  set onbeforeunload(callback: mixed) {
    if (typeof callback === 'function') {
      this._onbeforeunloadecb = callback;
      this._events.on(eventTitles.WINDOW_BEFORE_UNLOAD, this._onbeforeunloadecb);
    } else {
      this._events.removeListener(eventTitles.WINDOW_BEFORE_UNLOAD, this._onbeforeunloadecb);
    }
  }
}
