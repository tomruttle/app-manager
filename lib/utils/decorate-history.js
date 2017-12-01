// @flow

import type History from 'html5-history';

import { APP_MANAGER_ID } from '../constants';

type WindowType = any;

export default function decorateHistory(w: WindowType, history: History) {
  function bind(event: string, callback: () => mixed) {
    if (typeof callback !== 'function') {
      throw new Error('Callback function is required to bind event.');
    }

    callback.appManagerId = APP_MANAGER_ID; // eslint-disable-line no-param-reassign
    history.Adapter.bind(w, event, callback);
  }

  function unbind(event: string) {
    const uid = history.Adapter.uid(w);

    if (uid && history.Adapter.handlers[uid]) {
      const wHandlers = history.Adapter.handlers[uid];

      if (Array.isArray(wHandlers[event])) {
        wHandlers[event] = wHandlers[event].filter((callback) => callback.appManagerId !== APP_MANAGER_ID);
      }
    }
  }

  function trigger(event: string, data: mixed) {
    const uid = history.Adapter.uid(w);

    if (uid && history.Adapter.handlers[uid]) {
      const wHandlers = history.Adapter.handlers[uid];

      if (Array.isArray(wHandlers[event])) {
        wHandlers[event].forEach((callback) => callback.appManagerId === APP_MANAGER_ID && typeof callback === 'function' && callback(data));
      }
    }
  }

  return Object.assign({}, history, { events: { bind, unbind, trigger } });
}
