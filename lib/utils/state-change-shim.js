// @flow

/* eslint-disable no-param-reassign */

import { eventTitles } from '../constants';

import type { EventsType } from '../index';
import type Window from './window-stub';

export default function stateChangeShim(w: Window, events: EventsType) {
  if (!w.history) {
    throw new Error('HTML5 history API required.');
  }

  // $FlowFixMe
  const { onpopstate, onbeforeunload } = w;
  const { pushState, replaceState } = w.history;

  w.history.pushState = function patchedPushState(state, title, hash) {
    pushState.call(w.history, state, title, hash);

    events.emit(eventTitles.HISTORY_PUSH_STATE, state);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, state);
  };

  w.history.replaceState = function patchedReplaceState(state, title, hash) {
    replaceState.call(w.history, state, title, hash);

    events.emit(eventTitles.HISTORY_REPLACE_STATE, state);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, state);
  };

  w.onpopstate = function popState(state) {
    if (typeof onpopstate === 'function') {
      onpopstate(state);
    }

    events.emit(eventTitles.HISTORY_POP_STATE, state);
    events.emit(eventTitles.HISTORY_STATE_CHANGE, state);
  };

  w.onbeforeunload = function beforeunload() {
    if (typeof onbeforeunload === 'function') {
      onbeforeunload();
    }

    w.onpopstate = onpopstate;
    w.history.pushState = pushState;
    w.history.replaceState = replaceState;
  };
}
