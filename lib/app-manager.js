// @flow

import AppManagerError from './utils/app-manager-error';
import initUpdateState from './state';
import initReconcile from './reconcile';
import initGetFragmentScript from './script';
import initGetElement from './element';
import initCreateLifecycle from './lifecycle';
import initUpdatePage from './update';
import initGetPageFragments from './fragments';
import Context from './utils/context';
import wrapScript from './utils/wrap-script';
import { IMPORT_TIMEOUT, eventTitles, levels } from './constants';
import { defaultGetRouteNameFromResource, defaultGetElement, setNames } from './utils/config';

import type {
  ConfigType,
  OptionsType,
  StateType,
  EventsType,
  ScriptType,
  RootStateType,
  AppManagerScriptType,
} from './index';

export { statuses, levels } from './constants';

export function getAppManagerScript(config: ConfigType, events?: ?EventsType, options?: ?OptionsType): AppManagerScriptType {
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);
  const routes = setNames(config.routes);

  let importTimeout = IMPORT_TIMEOUT;
  let getRouteNameFromResource = defaultGetRouteNameFromResource(routes);
  let getElement = defaultGetElement;
  let onRecoverableError = (err) => { throw err; };
  let onNoRoute;
  let getAdditionalState;

  if (options) {
    if (typeof options.importTimeout === 'number') {
      ({ importTimeout } = options);
    }

    if (typeof options.getRouteNameFromResource === 'function') {
      ({ getRouteNameFromResource } = options);
    }

    if (typeof options.getElement === 'function') {
      ({ getElement } = options);
    }

    if (typeof options.getAdditionalState === 'function') {
      ({ getAdditionalState } = options);
    }
  }

  if (events && typeof events.emit === 'function') {
    onRecoverableError = events.emit.bind(events, eventTitles.WARNING);
    onNoRoute = events.emit.bind(events, eventTitles.NO_ROUTE);
  }

  const updateState = initUpdateState(routes, getRouteNameFromResource, getAdditionalState);
  const getPageFragments = initGetPageFragments(slots, fragments, routes);
  const reconcile = initReconcile(getPageFragments);
  const getSlotElement = initGetElement(slots, getElement, importTimeout);

  const context = new Context();

  const getFragmentScript = initGetFragmentScript(fragments, importTimeout, context);
  const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context, onRecoverableError);
  const updatePage = initUpdatePage(reconcile, createLifecycle, onRecoverableError);

  const script = {
    version: 6,

    async hydrate(container: Element, parentState: StateType | RootStateType) {
      const state = await updateState(parentState);

      if (!state.route) {
        throw new AppManagerError('No route found on hydrate', {
          source: 'hydrate_script',
          recoverable: false,
          level: levels.ERROR,
          fragment: null,
          slot: null,
          code: 'no_route',
        });
      }

      context.setState(state);

      await updatePage(container, state);
    },

    async render(container: Element, parentState: StateType | RootStateType) {
      const state = await updateState(parentState);

      if (!state.route) {
        throw new AppManagerError('No route found on render', {
          source: 'render_script',
          recoverable: false,
          level: levels.ERROR,
          fragment: null,
          slot: null,
          code: 'no_route',
        });
      }

      context.setState(state);

      if (options && typeof options.getLayout === 'function') {
        /* eslint-disable no-param-reassign */

        container.innerHTML = await options.getLayout(state);
      }

      await updatePage(container, state);
    },

    async onStateChange(container: Element, parentState: StateType | RootStateType) {
      const state = await updateState(parentState, context.state.route);

      if (state) {
        context.setState(state);

        await updatePage(container, state);
      } else if (typeof onNoRoute === 'function') {
        onNoRoute(parentState);
      } else {
        throw new AppManagerError('No route found on state change', {
          source: 'on_state_change_script',
          recoverable: false,
          level: levels.ERROR,
          fragment: null,
          slot: null,
          code: 'no_route',
        });
      }
    },

    async unmount(container: Element, parentState: StateType | RootStateType) {
      const state = await updateState(parentState, context.state.route);

      context.setState(state);

      await updatePage(container, state);
    },
  };

  // $FlowFixMe until https://github.com/facebook/flow/issues/285 is fixed.
  return Object.defineProperty(script, 'state', {
    enumerable: true,
    get() { return context.state; },
  });
}

export function appManager(config: ConfigType, events?: ?EventsType, options?: ?OptionsType): ScriptType {
  const appManagerScript = getAppManagerScript(config, events, options);
  return wrapScript(appManagerScript);
}

export default function getAppManagerCallback(config: ConfigType, events: EventsType, options: ?OptionsType) {
  const appManagerScript = getAppManagerScript(config, events, options);

  return async function appManagerCallback(container: Element, state: RootStateType) {
    if (state.eventTitle === eventTitles.INITIALISE) {
      await appManagerScript.hydrate(container, state);
    } else if (state.eventTitle === eventTitles.WINDOW_BEFORE_UNLOAD) {
      await appManagerScript.unmount(container, state);
    } else {
      await appManagerScript.onStateChange(container, state);
    }
  };
}
