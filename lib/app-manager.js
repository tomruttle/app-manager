// @flow

import initUpdateState from './state';
import initReconcile from './reconcile';
import initGetFragmentScript from './script';
import initGetElement from './element';
import initCreateLifecycle from './lifecycle';
import initUpdatePage from './update';
import initGetPageFragments from './fragments';
import Context from './utils/context';
import { IMPORT_TIMEOUT } from './constants';
import { defaultGetRouteNameFromResource, initDefaultGetElement, setNames } from './utils/config';

import type { ConfigType, OverrideOptionsType, GetElementWindowType } from './index';

export default function initAppManager(w: GetElementWindowType) {
  return function appManager(config: ConfigType, overrideOptions?: OverrideOptionsType) {
    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);
    const routes = setNames(config.routes);

    const options = {
      importTimeout: IMPORT_TIMEOUT,
      getRouteNameFromResource: defaultGetRouteNameFromResource(routes),
      getElement: initDefaultGetElement(w),
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

    const updateState = initUpdateState(routes, getRouteNameFromResource, getAdditionalState);
    const getFragmentScript = initGetFragmentScript(fragments, importTimeout, context);
    const getSlotElement = initGetElement(slots, getElement, importTimeout);
    const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context);
    const getPageFragments = initGetPageFragments(slots, fragments, routes);
    const reconcile = initReconcile(getPageFragments);
    const updatePage = initUpdatePage(reconcile, createLifecycle, updateState, context);

    // $FlowFixMe until https://github.com/facebook/flow/issues/285 is fixed.
    Object.defineProperty(updatePage, 'state', {
      enumerable: true,
      get() { return context.state; },
    });

    return updatePage;
  };
}
