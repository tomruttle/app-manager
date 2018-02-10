// @flow

import AppManagerError from './utils/app-manager-error';
import { setNames, retry, defaultGetAppNameFromUrl, getErrorStatusDetails, getLoadingStatusDetails, getDefaultStatusDetails } from './utils/config';
import shimHistory from './utils/shim-history';
import initReconcile from './utils/reconcile';
import initLifecycle from './utils/lifecycle';
import initGetState from './utils/get-state';

import type {
  EventsType,
  OverrideOptionsType,
  ConfigType,
  StateType,
  StateChangeType,
  SlotNameType,
  FragmentNameType,
} from './index';

import type Window from './utils/window-stub';

import { DEFAULT_TIMEOUT, DOM_CHECK_INTERVAL, statuses, eventTitles, levels } from './constants';

export default function initAppManager(w: Window) {
  if (!w.document || !w.location || !w.history) {
    throw new AppManagerError('Invalid window object. Aborting.', {
      source: 'init',
      level: levels.ERROR,
      fragment: null,
      slot: null,
      app: null,
      path: null,
      code: 'invalid_environment',
      recoverable: false,
    });
  }

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
  }

  function getBrowserLocation(): { pathname: string, search: string } {
    return w.location;
  }

  function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
    if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
      throw new AppManagerError('Invalid events object. Aborting.', {
        source: 'init',
        level: levels.ERROR,
        fragment: null,
        slot: null,
        app: null,
        path: null,
        code: 'invalid_events',
        recoverable: false,
      });
    }

    let runningStateChange: ?StateChangeType = null;
    let state: StateType;

    let queuedStateChange: ?() => StateChangeType = null;

    const defaultOptions = {
      haltOnError: false,
      importTimeout: DEFAULT_TIMEOUT,
      getAppNameFromUrl: defaultGetAppNameFromUrl(config.apps),
      onError(err) {
        events.emit(eventTitles.ERROR, err);
        events.emit(eventTitles.STATUS_CHANGE, getErrorStatusDetails(err));
      },
    };

    const options = Object.assign({}, defaultOptions, overrideOptions || {});

    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);
    const apps = setNames(config.apps);

    async function getSlotElement(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?Element> {
      const errData = {
        source: 'get_slot_element',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      const slot = slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Slot ${slotName} could not be found.`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'slot_not_found',
          recoverable: false,
        }));
      }

      const { querySelector } = slot;

      if (!querySelector) {
        return null;
      }

      const element = await retry(
        () => selectFromDom(querySelector),
        DOM_CHECK_INTERVAL,
        options.importTimeout,
      );

      if (!element) {
        throw new AppManagerError(`Element ${querySelector} not found for slot ${slotName}.`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'element_not_found',
          recoverable: false,
        }));
      }

      return element;
    }

    const reconcile = initReconcile(config);
    const lifecycle = initLifecycle(w, fragments, getSlotElement, options);
    const getState = initGetState(apps, options);

    function getStateChanger(initialRender: boolean, eventTitle?: mixed) {
      return async function stateChanger(): Promise<void> {
        try {
          const currentApp = state ? state.app : null;
          const { pathname, search } = getBrowserLocation();
          const newState = await getState(`${pathname}${search}`, currentApp, eventTitle);

          if (!newState) {
            events.emit(eventTitles.EXTERNAL_LINK);
            return;
          }

          state = newState;
        } catch (err) {
          options.onError(err);
          return;
        }

        events.emit(eventTitles.STATUS_CHANGE, getLoadingStatusDetails());

        try {
          const pageDiff = reconcile(state, initialRender);

          const haveScripts = await lifecycle(state, pageDiff, initialRender);

          events.emit(eventTitles.STATUS_CHANGE, getDefaultStatusDetails());

          if (!haveScripts) {
            events.emit(eventTitles.EXTERNAL_LINK);
            return;
          }
        } catch (err) {
          options.onError(err);
        }

        const nextStateChange = queuedStateChange;

        if (typeof nextStateChange === 'function' && !options.haltOnError) {
          queuedStateChange = null;
          runningStateChange = nextStateChange();
        } else {
          runningStateChange = null;
        }
      };
    }

    function handleStateChange(eventTitle: mixed): void {
      const stateChanger = getStateChanger(false, eventTitle);

      if (runningStateChange) {
        queuedStateChange = stateChanger;
      } else {
        runningStateChange = stateChanger();
      }
    }

    shimHistory(w, events, handleStateChange);

    runningStateChange = getStateChanger(true)();

    return {
      getState() { return state; },
      getRunningStateChange() { return runningStateChange; },
    };
  }

  appManager.statuses = statuses;
  appManager.eventTitles = eventTitles;
  appManager.levels = levels;

  return appManager;
}
