// @flow

/* eslint-disable no-param-reassign */

import { eventTitles } from '../constants';

import type { EmitterType } from '../index';
import type Window from './window-stub';

export default function stateChangeShim(w: Window, emit: EmitterType) {
  if (!w.history) {
    throw new Error('HTML5 history API required.');
  }

  const { onpopstate, onbeforeunload } = w;
  const { pushState, replaceState } = w.history;

  w.history.pushState = function patchedPushState(state, title, hash) {
    pushState.call(w.history, state, title, hash);

    emit(eventTitles.HISTORY_PUSH_STATE, state);
    emit(eventTitles.HISTORY_STATE_CHANGE, state);
  };

  w.history.replaceState = function patchedReplaceState(state, title, hash) {
    replaceState.call(w.history, state, title, hash);

    emit(eventTitles.HISTORY_REPLACE_STATE, state);
    emit(eventTitles.HISTORY_STATE_CHANGE, state);
  };

  // $FlowFixMe
  w.history.getState = function getState() {
    return {
      data: w.history.state,
      title: w.location.title,
      hash: w.location.pathname,
    };
  };

  w.onpopstate = function popState(state) {
    if (typeof onpopstate === 'function') {
      onpopstate(state);
    }

    emit(eventTitles.HISTORY_POP_STATE, state);
    emit(eventTitles.HISTORY_STATE_CHANGE, state);
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
