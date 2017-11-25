// @flow

import type History from 'html5-history';

type WindowType = any;

export default function decorateHistory(w: WindowType, history: History) {
  function bind(event: string, id: string, callback: Function) {
    if (typeof callback !== 'function') {
      throw new Error('Callback function is required to bind event.');
    }

    callback.appManagerId = id; // eslint-disable-line no-param-reassign
    return history.Adapter.bind(w, event, callback);
  }

  function unbind(event: string, id: string) {
    const uid = history.Adapter.uid(w);

    if (uid && history.Adapter.handlers[uid]) {
      const wHandlers = history.Adapter.handlers[uid];

      if (Array.isArray(wHandlers[event])) {
        wHandlers[event] = wHandlers[event].filter((callback) => callback.appManagerId !== id);
      }
    }
  }

  function trigger(event: string, data: mixed) {
    return history.Adapter.trigger(w, event, data);
  }

  return Object.assign({}, history, { events: { bind, unbind, trigger } });
}
