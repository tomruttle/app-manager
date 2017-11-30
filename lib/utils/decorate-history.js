// @flow

import type History from 'html5-history';

type WindowType = any;

const APP_MANAGER_ID = 'app-manager';

export default function decorateHistory(w: WindowType, history: History) {
  function bind(event: string, callback: Function) {
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
    history.Adapter.trigger(w, event, data);
  }

  return Object.assign({}, history, { events: { bind, unbind, trigger } });
}
