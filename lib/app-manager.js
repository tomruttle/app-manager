// @flow

import {
  setNames,
  defaultGetAppNameFromResource,
} from './utils/config';

import initReconcile from './utils/reconcile';
import initLifecycle from './utils/lifecycle';
import initUpdateState from './utils/state';
import initLoadScript from './utils/script';

import type {
  OverrideOptionsType,
  ConfigType,
} from './index';

import type Window from './utils/window-stub';

import { IMPORT_TIMEOUT, DOM_CHECK_INTERVAL, statuses, eventTitles, levels } from './constants';

export default function initAppManager(w: Window) {
  function appManager(config: ConfigType, overrideOptions?: OverrideOptionsType) {
    const defaultOptions = {
      importTimeout: IMPORT_TIMEOUT,
      domCheckInterval: DOM_CHECK_INTERVAL,
      getAppNameFromResource: defaultGetAppNameFromResource(config.apps),
    };

    const options = Object.assign({}, defaultOptions, overrideOptions || {});

    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);
    const apps = setNames(config.apps);

    const reconcile = initReconcile(config);
    const updateState = initUpdateState(apps, options);
    const loadScript = initLoadScript(fragments, options, updateState);
    const lifecycle = initLifecycle(w, fragments, slots, loadScript, options);

    return async function stateChanger(newState, oldState): Promise<boolean> {
      const newAppName = await options.getAppNameFromResource(newState.resource);
      const oldAppName = oldState ? await options.getAppNameFromResource(oldState.resource) : null;

      const initialRender = !oldAppName;
      const pageDiff = reconcile(newAppName, oldAppName);
      const haveScripts = await lifecycle(pageDiff, initialRender);

      return Boolean(haveScripts || initialRender);
    };
  }

  appManager.statuses = statuses;
  appManager.eventTitles = eventTitles;
  appManager.levels = levels;

  return appManager;
}
