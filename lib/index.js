// @flow

/* global window */

import initHistoryCallback from './history-callback';
import getAppManagerCallback from './app-manager';

import type { ConfigType, EventsType, OverrideOptionsType } from './index';

export { eventTitles, levels, statuses } from './constants';
export { appManager } from './app-manager';

const historyCallback = initHistoryCallback(window);

export default function initAppManager(config: ConfigType, events: EventsType, options?: OverrideOptionsType) {
  if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
    throw new Error('Invalid events object. Aborting.');
  }

  const appManagerCallback = getAppManagerCallback(config, events, options);

  return historyCallback(appManagerCallback, events);
}
