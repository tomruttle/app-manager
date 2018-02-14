// @flow

import type { EventsType } from '../index';

import type Window from './window-stub';

import { eventTitles } from '../constants';

export default function shimHistory(w: Window, events: EventsType, callback: (event: mixed) => void) {
  /* eslint-disable no-param-reassign */

  const { onpopstate, onbeforeunload } = w;
  const { pushState, replaceState } = w.history;

  w.history.pushState = (...args) => {
    if (typeof pushState === 'function') {
      pushState.apply(w.history, args);
    }

    events.emit(eventTitles.HISTORY_PUSH_STATE);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_PUSH_STATE);
  };

  w.history.replaceState = (...args) => {
    if (typeof replaceState === 'function') {
      replaceState.apply(w.history, args);
    }

    events.emit(eventTitles.HISTORY_REPLACE_STATE);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_REPLACE_STATE);
  };

  w.onpopstate = (...args) => {
    if (typeof onpopstate === 'function') {
      onpopstate.apply(w.history, args);
    }

    events.emit(eventTitles.HISTORY_POP_STATE);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_POP_STATE);
  };

  w.onbeforeunload = (...args) => {
    if (typeof onbeforeunload === 'function') {
      onbeforeunload.apply(w.history, args);
    }

    events.removeListener(eventTitles.HISTORY_STATE_CHANGE, callback);

    w.onpopstate = onpopstate;
    w.history.pushState = pushState;
    w.history.replaceState = replaceState;
  };

  events.on(eventTitles.HISTORY_STATE_CHANGE, callback);
}
