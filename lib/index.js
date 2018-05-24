// @flow

/* global window */

import initHistoryCallback from './history-callback';
import appManager from './app-manager';

import type { ConfigType, EventsType, OverrideOptionsType } from './index';

const historyCallback = initHistoryCallback(window);

export default function initAppManager(config: ConfigType, events: EventsType, options?: OverrideOptionsType) {
  if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
    throw new Error('Invalid events object. Aborting.');
  }

  const script = appManager(config, events, options);

  return historyCallback(script, events);
}
