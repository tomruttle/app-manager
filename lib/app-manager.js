// @flow

import AppManagerError from './utils/app-manager-error';
import {
  setNames,
  retry,
  generateUID,
  defaultGetAppNameFromUrl,
  getErrorStatusDetails,
  getLoadingStatusDetails,
  getDefaultStatusDetails,
} from './utils/config';

import shimHistory from './utils/shim-history';
import initReconcile from './utils/reconcile';
import initLifecycle from './utils/lifecycle';
import initUpdateState from './utils/state';
import initWrapScript from './utils/script';


import type {
  EventsType,
  OverrideOptionsType,
  ConfigType,
  StateWithAdditionsType,
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
      code: 'invalid_environment',
      recoverable: false,
    });
  }

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
  }

  function getLocation(): { href: string, pathname: string, search: ?string } {
    return w.location;
  }

  function getCurrentUrl(): string {
    return getLocation().href;
  }

  function getCurrentResource(): string {
    const { pathname, search } = getLocation();
    return `${pathname}${search || ''}`;
  }

  function getBrowserTitle(): ?string {
    return w.document.title;
  }

  function setBrowserState(newState: StateWithAdditionsType): void {
    const url = getCurrentUrl();
    const title = getBrowserTitle();
    w.history.replaceState(newState, title, url);
  }

  function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
    if (!events || typeof events.emit !== 'function' || typeof events.on !== 'function' || typeof events.removeListener !== 'function') {
      throw new AppManagerError('Invalid events object. Aborting.', {
        source: 'init',
        level: levels.ERROR,
        fragment: null,
        slot: null,
        code: 'invalid_events',
        recoverable: false,
      });
    }

    let state: StateWithAdditionsType;
    let eventId: string = generateUID();
    let runningStateChange: ?StateChangeType = null;
    let queuedStateChange: ?() => StateChangeType = null;

    const defaultOptions = {
      haltOnError: false,
      importTimeout: DEFAULT_TIMEOUT,
      domCheckInterval: DOM_CHECK_INTERVAL,
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
        options.domCheckInterval,
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

    function getState(): ?StateWithAdditionsType {
      return state;
    }

    const reconcile = initReconcile(config);
    const wrapScript = initWrapScript(w, getState);
    const lifecycle = initLifecycle(fragments, wrapScript, getSlotElement, options);
    const updateState = initUpdateState(apps, options);

    function setState(eventTitle?: mixed) {
      const resource = getCurrentResource();
      const currentApp = state && state.app ? state.app : null;

      const newState = updateState(resource, currentApp, eventTitle);

      if (!newState) {
        events.emit(eventTitles.EXTERNAL_LINK);
        return;
      }

      state = Object.assign({}, newState, { eventId });
      setBrowserState(state);
    }

    function getStateChanger(initialRender: boolean) {
      return async function stateChanger(): Promise<void> {
        try {
          events.emit(eventTitles.STATUS_CHANGE, getLoadingStatusDetails());

          const pageDiff = reconcile(state, initialRender);

          const haveScripts = await lifecycle(pageDiff, initialRender);

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
      if (!state) {
        return;
      }

      if (state.eventId !== eventId) {
        setState(eventTitle);
        return;
      }

      eventId = generateUID();

      const stateChanger = getStateChanger(!state.prevApp);

      if (runningStateChange) {
        queuedStateChange = stateChanger;
      } else {
        runningStateChange = stateChanger();
      }
    }

    shimHistory(w, events, handleStateChange);

    setState();

    return {
      getState,
      getRunningStateChange() { return runningStateChange; },
    };
  }

  appManager.statuses = statuses;
  appManager.eventTitles = eventTitles;
  appManager.levels = levels;

  return appManager;
}
