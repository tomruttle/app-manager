// @flow

/* global window */

import Context from './utils/context';
import initReconcile from './utils/reconcile';
import initGetFragmentScript from './utils/script';
import initGetElement from './utils/element';
import initCreateLifecycle from './utils/lifecycle';
import initStateChanger from './utils/state-changer';
import initHistoryCallback, { eventTitles, type EventsType } from './utils/history-callback';
import { statuses, levels, IMPORT_TIMEOUT } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement, setNames } from './utils/config';

import type { ConfigType, OverrideOptionsType } from './index.js.flow';

const historyCallback = initHistoryCallback(window);

function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);
  const routes = setNames(config.routes);

  const options = {
    importTimeout: IMPORT_TIMEOUT,
    getRouteNameFromResource: defaultGetRouteNameFromResource(routes),
    getElement: defaultGetElement(window),
    ...overrideOptions,
  };

  const {
    getRouteNameFromResource,
    getAdditionalState,
    importTimeout,
    getElement,
  } = options;

  const context = new Context(routes, getRouteNameFromResource, getAdditionalState);

  const getFragmentScript = initGetFragmentScript(fragments, importTimeout, context);
  const getSlotElement = initGetElement(slots, getElement, importTimeout);
  const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context);
  const reconcile = initReconcile(slots, fragments, routes);
  const stateChanger = initStateChanger(reconcile, createLifecycle, context);

  return historyCallback(stateChanger, events);
}

appManager.eventTitles = eventTitles;
appManager.statuses = statuses;
appManager.levels = levels;

export default appManager;
