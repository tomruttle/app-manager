// @flow

/* global window */

import initHistoryCallback from './history-callback';
import getAppManagerCallback from './app-manager';

import type { ConfigType, EventsType, OptionsType } from './index';

export { eventTitles, levels, statuses } from './constants';
export { appManager } from './app-manager';

const historyCallback = initHistoryCallback(window);

export default function initAppManager(config: ConfigType, events: EventsType, options?: OptionsType) {
  const appManagerCallback = getAppManagerCallback(config, events, options);

  return historyCallback(appManagerCallback, events);
}
