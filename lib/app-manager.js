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
import { IMPORT_TIMEOUT, eventTitles } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement, setNames } from './utils/config';

import type {
  ConfigType,
  OverrideOptionsType,
  StateWithAdditionsType,
  EventsType,
} from './index';

export { statuses, levels } from './constants';

export default function appManager(config: ConfigType, events?: ?EventsType, overrideOptions?: OverrideOptionsType) {
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

  let onRecoverableError = (_error) => {};
  let onNoRoute = (_state) => {};

  if (events && typeof events.emit === 'function') {
    onRecoverableError = events.emit.bind(events, eventTitles.WARNING);
    onNoRoute = events.emit.bind(events, eventTitles.NO_ROUTE);
  }

  const context = new Context();

  const updateState = initUpdateState(routes, getRouteNameFromResource, getAdditionalState);
  const getFragmentScript = initGetFragmentScript(fragments, importTimeout, context);
  const getPageFragments = initGetPageFragments(slots, fragments, routes);
  const reconcile = initReconcile(getPageFragments);
  const getSlotElement = initGetElement(slots, getElement, importTimeout);
  const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context, onRecoverableError);
  const updatePage = initUpdatePage(reconcile, createLifecycle, onRecoverableError);

  const script = wrapScript({
    version: 6,

    async render(container: Element, parentState: StateWithAdditionsType) {
      const state = await updateState(parentState);

      context.setState(state);

      await updatePage(container, state);
    },

    async onStateChange(container: Element, parentState: StateWithAdditionsType) {
      const state = await updateState(parentState, context.state.route);

      context.setState(state);

      await updatePage(container, state);

      onNoRoute(parentState);
    },
  });

  // $FlowFixMe until https://github.com/facebook/flow/issues/285 is fixed.
  Object.defineProperty(script, 'state', {
    enumerable: true,
    get() { return context.state; },
  });

  return script;
}
