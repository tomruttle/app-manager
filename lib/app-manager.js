// @flow

import initUpdateState from './state';
import initReconcile from './reconcile';
import initGetFragmentScript from './script';
import initGetElement from './element';
import initCreateLifecycle from './lifecycle';
import initStateChanger from './state-changer';
import initGetPageFragments from './fragments';
import Context from './utils/context';
import initHistoryCallback, { eventTitles, type EventsType } from './history-callback';
import { statuses, levels, IMPORT_TIMEOUT } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement, setNames } from './utils/config';

import type { ConfigType, OverrideOptionsType } from './index.js.flow';

import type Window from './utils/window-stub';

export default function initAppManager(w: Window) {
  function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);
    const routes = setNames(config.routes);

    const options = {
      importTimeout: IMPORT_TIMEOUT,
      getRouteNameFromResource: defaultGetRouteNameFromResource(routes),
      getElement: defaultGetElement(w),
      getAdditionalState: undefined,
    };

    if (overrideOptions) {
      if (typeof overrideOptions.importTimeout === 'number') {
        Object.assign(options, { importTimeout: overrideOptions.importTimeout });
      }

      if (typeof overrideOptions.getRouteNameFromResource === 'function') {
        Object.assign(options, { getRouteNameFromResource: overrideOptions.getRouteNameFromResource });
      }

      if (typeof overrideOptions.getElement === 'function') {
        Object.assign(options, { getElement: overrideOptions.getElement });
      }

      if (typeof overrideOptions.getAdditionalState === 'function') {
        Object.assign(options, { getAdditionalState: overrideOptions.getAdditionalState });
      }
    }

    const {
      getRouteNameFromResource,
      getAdditionalState,
      importTimeout,
      getElement,
    } = options;

    const context = new Context();

    const historyCallback = initHistoryCallback(w);
    const updateState = initUpdateState(routes, getRouteNameFromResource, getAdditionalState);
    const getFragmentScript = initGetFragmentScript(fragments, importTimeout, context);
    const getSlotElement = initGetElement(slots, getElement, importTimeout);
    const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context);
    const getPageFragments = initGetPageFragments(slots, fragments, routes);
    const reconcile = initReconcile(getPageFragments);
    const stateChanger = initStateChanger(reconcile, createLifecycle, updateState, context);

    return historyCallback(stateChanger, events);
  }

  appManager.eventTitles = eventTitles;
  appManager.statuses = statuses;
  appManager.levels = levels;

  return appManager;
}
