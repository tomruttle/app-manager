// @flow

import { eventTitles } from './constants';

import type { RootStateType, EventsType, OptionsType } from './index';

import { defaultGetElement } from './utils/config';

type StateChangeType = Promise<void>;
type HistoryCallbackType = (container: Element, state: RootStateType) => Promise<void>;

export default function iniHistoryCallback(w: any) {
  if (!w.document || !w.location || !w.history) {
    throw new Error('Invalid window object. Aborting.');
  }

  function getCurrentResource(): string {
    const { pathname, search } = w.location;
    return `${pathname}${search || ''}`;
  }

  function getHistoryState(): ?Object {
    return w.history.state;
  }

  function getCurrentTitle(): ?string {
    return w.document.title;
  }

  function shimHistory(events: EventsType, callback: (eventTitle: string) => void) {
    /* eslint-disable no-param-reassign */

    const { onpopstate, onbeforeunload, history } = w;
    const { pushState, replaceState } = history;

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

      events.emit(eventTitles.WINDOW_BEFORE_UNLOAD);
      events.removeListener(eventTitles.HISTORY_STATE_CHANGE, callback);

      w.onpopstate = onpopstate;
      w.history.pushState = pushState;
      w.history.replaceState = replaceState;
    };

    events.on(eventTitles.HISTORY_STATE_CHANGE, callback);
  }

  return async function historyCallback(callback: HistoryCallbackType, events: EventsType, options?: OptionsType) {
    if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
      throw new Error('Invalid events object. Aborting.');
    }

    let runningStateChange: ?StateChangeType = null;
    let queuedStateChange: ?string = null;

    let parentElement;
    let getElement = defaultGetElement;

    if (options) {
      if (typeof options.getElement === 'function') {
        ({ getElement } = options);
      }

      if (typeof options.parentQuerySelector === 'string') {
        parentElement = await getElement(w.document, options.parentQuerySelector);
      }
    }

    async function stateChanger(eventTitle: string) {
      try {
        await callback(parentElement || w.document, {
          rootState: true,
          resource: getCurrentResource(),
          title: getCurrentTitle(),
          historyState: getHistoryState(),
          eventTitle,
        });

        const nextStateChange = queuedStateChange;

        if (typeof nextStateChange !== 'string') {
          runningStateChange = null;
          return;
        }

        queuedStateChange = null;
        runningStateChange = stateChanger(nextStateChange);
      } catch (err) {
        runningStateChange = null;
        events.emit(eventTitles.ERROR, err);
      }
    }

    function handleStateChange(eventTitle: string): void {
      if (runningStateChange) {
        queuedStateChange = eventTitle;
      } else {
        runningStateChange = stateChanger(eventTitle);
      }
    }

    shimHistory(events, handleStateChange);

    handleStateChange(eventTitles.INITIALISE);

    return {
      get runningStateChange() {
        return runningStateChange;
      },

      get queuedStateChange() {
        return queuedStateChange;
      },
    };
  };
}
