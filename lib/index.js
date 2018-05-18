// @flow

import initUpdateState from './state';
import initReconcile from './reconcile';
import initGetFragmentScript from './script';
import initGetElement from './element';
import initCreateLifecycle from './lifecycle';
import initUpdatePage from './update';
import initGetPageFragments from './fragments';
import Context from './utils/context';
import wrapScript from './utils/wrap-script';
import { IMPORT_TIMEOUT } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement, setNames } from './utils/config';

import type {
  ConfigType,
  OverrideOptionsType,
  StateWithAdditionsType,
} from './index';

export { statuses, levels } from './constants';

export default function appManager(config: ConfigType, overrideOptions?: OverrideOptionsType) {
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);
  const routes = setNames(config.routes);

  const options = {
    importTimeout: IMPORT_TIMEOUT,
    getRouteNameFromResource: defaultGetRouteNameFromResource(routes),
    getElement: defaultGetElement,
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
  const getPageFragments = initGetPageFragments(slots, fragments, routes);
  const reconcile = initReconcile(getPageFragments);

  let updatePage;

  return wrapScript({
    version: 6,

    async render(container: Element, state: StateWithAdditionsType) {
      const getSlotElement = initGetElement(slots, container, getElement, importTimeout);
      const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context);
      updatePage = initUpdatePage(reconcile, createLifecycle, updateState, context);

      await updatePage(state, true);
    },

    async onStateChange(state: StateWithAdditionsType) {
      await updatePage(state, false);
    },
  });
}
