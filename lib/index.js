// @flow

/* global window */

import initAppManagerCallback from './app-manager';
import initHistoryCallback, { eventTitles, type EventsType } from './utils/history-callback';
import { statuses, levels } from './constants';

import type { ConfigType, OverrideOptionsType } from './index.js.flow';

const appManagerCallback = initAppManagerCallback(window);
const historyCallback = initHistoryCallback(window);

function appManager(config: ConfigType, events: EventsType, options?: OverrideOptionsType) {
  return historyCallback(appManagerCallback(config, options), events);
}

appManager.eventTitles = eventTitles;
appManager.statuses = statuses;
appManager.levels = levels;

export default appManager;
