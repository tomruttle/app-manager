// @flow

import type Window from './window-stub';

const HISTORY_CALLBACK_NAMESPACE = 'hc';

export const eventTitles = {
  HALTED: `${HISTORY_CALLBACK_NAMESPACE}-halted`,
  ERROR: `${HISTORY_CALLBACK_NAMESPACE}-error`,
  WINDOW_BEFORE_UNLOAD: `${HISTORY_CALLBACK_NAMESPACE}-beforeunload`,
  HISTORY_POP_STATE: `${HISTORY_CALLBACK_NAMESPACE}-popstate`,
  HISTORY_REPLACE_STATE: `${HISTORY_CALLBACK_NAMESPACE}-replacestate`,
  HISTORY_PUSH_STATE: `${HISTORY_CALLBACK_NAMESPACE}-pushstate`,
  HISTORY_STATE_CHANGE: `${HISTORY_CALLBACK_NAMESPACE}-statechange`,
};

export type EventTitleType = $Values<typeof eventTitles>;

export type StateChangeType = Promise<void>;
export type BrowserStateType = {
  resource: string,
  title?: ?string,
  state?: ?Object,
  eventTitle?: ?mixed,
};

type HistoryCallbackType = (state: BrowserStateType) => Promise<boolean>;
type EventCallbackType = (...data: Array<any>) => any;
type EmitterType = (eventTitle: EventTitleType, ...data: Array<any>) => void;
type SubscriberType = (eventTitle: EventTitleType, callback: EventCallbackType) => void;
type RemoveListenerType = (eventTitle: EventTitleType, callback: EventCallbackType) => void;

export type EventsType = {
  emit: EmitterType,
  on: SubscriberType,
  removeListener: RemoveListenerType,
}

export default function iniHistoryCallback(w: Window) {
  if (!w.document || !w.location || !w.history) {
    throw new Error('Invalid window object. Aborting.');
  }

  function getCurrentResource(): string {
    const { pathname, search } = w.location;
    return `${pathname}${search || ''}`;
  }

  function getCurrentState(): ?Object {
    return w.history.state;
  }

  function getCurrentTitle(): ?string {
    return w.document.title;
  }

  function shimHistory(events: EventsType, callback: (event: mixed) => void) {
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

  return function historyCallback(callback: HistoryCallbackType, events: EventsType) {
    if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
      throw new Error('Invalid events object. Aborting.');
    }

    let runningStateChange: ?StateChangeType = null;
    let queuedStateChange: mixed = null;

    async function stateChanger(eventTitle: mixed = null) {
      try {
        const proceed = await callback({
          resource: getCurrentResource(),
          title: getCurrentTitle(),
          state: getCurrentState(),
          eventTitle,
        });

        if (!proceed) {
          events.emit(eventTitles.HALTED);
          runningStateChange = null;
          return;
        }

        const nextStateChange = queuedStateChange;

        if (!nextStateChange) {
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

    function handleStateChange(eventTitle: mixed): void {
      if (runningStateChange) {
        queuedStateChange = eventTitle;
      } else {
        runningStateChange = stateChanger(eventTitle);
      }
    }

    shimHistory(events, handleStateChange);

    handleStateChange();

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
