// @flow

/* global window */

import initHistoryCallback from './history-callback';
import appManager from './app-manager';

import type { ConfigType, EventsType, OverrideOptionsType } from './index';

const historyCallback = initHistoryCallback(window);

export default function initAppManager(config: ConfigType, events: EventsType, options?: OverrideOptionsType) {
  return historyCallback(appManager(config, options), events);
}
