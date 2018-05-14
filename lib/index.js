// @flow

/* global window */

import appManagerCallback from './app-manager';
import initHistoryCallback, { eventTitles, type EventsType } from './utils/history-callback';
import { statuses, levels, IMPORT_TIMEOUT } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement } from './utils/config';

import type { ConfigType, OverrideOptionsType } from './index.js.flow';

const historyCallback = initHistoryCallback(window);

function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
  const options = {
    importTimeout: IMPORT_TIMEOUT,
    getRouteNameFromResource: defaultGetRouteNameFromResource(config.routes),
    getElement: defaultGetElement(window),
    ...(overrideOptions || {}),
  };

  const stateChanger = appManagerCallback(config, options);
  return historyCallback(stateChanger, events);
}

appManager.eventTitles = eventTitles;
appManager.statuses = statuses;
appManager.levels = levels;

export default appManager;
