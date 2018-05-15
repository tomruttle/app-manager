// @flow

/* global window */

import initHistoryCallback, { type EventsType } from './history-callback';

import initAppManager from './app-manager';

import type { ConfigType, OverrideOptionsType } from './index.js.flow';

const appManager = initAppManager(window);
const historyCallback = initHistoryCallback(window);

export default function (config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
  const stateChanger = appManager(config, overrideOptions);
  return historyCallback(stateChanger, events);
}
