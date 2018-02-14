// @flow

import AppManagerError from './utils/app-manager-error';
import {
  setNames,
  retry,
  defaultGetAppNameFromUrl,
  getErrorStatusDetails,
  getLoadingStatusDetails,
  getDefaultStatusDetails,
} from './utils/config';

import shimHistory from './utils/shim-history';
import initReconcile from './utils/reconcile';
import initLifecycle from './utils/lifecycle';
import initUpdateState from './utils/state';
import initLoadScript from './utils/script';

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

import { IMPORT_TIMEOUT, DOM_CHECK_INTERVAL, statuses, eventTitles, levels } from './constants';

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

  function getCurrentResource(): string {
    const { pathname, search } = w.location;
    return `${pathname}${search || ''}`;
  }

  function appManager(config: ConfigType, events: EventsType, overrideOptions?: OverrideOptionsType) {
    let runningStateChange: ?StateChangeType = null;
    let queuedStateChange: mixed = null;
    let workingState: ?StateWithAdditionsType;

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

    const defaultOptions = {
      haltOnError: false,
      importTimeout: IMPORT_TIMEOUT,
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
      return workingState;
    }

    const reconcile = initReconcile(config);
    const loadScript = initLoadScript(w, fragments, options, getState);
    const lifecycle = initLifecycle(fragments, slots, loadScript, getSlotElement, options);
    const updateState = initUpdateState(apps, options);

    async function stateChanger(eventTitle: mixed): Promise<void> {
      try {
        const resource = getCurrentResource();
        const currentApp = workingState && workingState.app ? workingState.app : null;
        const newState = updateState(resource, currentApp, eventTitle);

        if (!newState) {
          events.emit(eventTitles.EXTERNAL_LINK);
          return;
        }

        workingState = newState;

        events.emit(eventTitles.STATUS_CHANGE, getLoadingStatusDetails());

        const initialRender = !workingState.prevApp;

        const pageDiff = reconcile(workingState, initialRender);

        const haveScripts = await lifecycle(pageDiff, initialRender);

        events.emit(eventTitles.STATUS_CHANGE, getDefaultStatusDetails());

        if (!haveScripts && !initialRender) {
          events.emit(eventTitles.MISSING_SCRIPTS);
          return;
        }
      } catch (err) {
        options.onError(err);
      }

      const nextStateChange = queuedStateChange;

      if (nextStateChange && !options.haltOnError) {
        queuedStateChange = null;
        runningStateChange = stateChanger(nextStateChange);
      } else {
        runningStateChange = null;
      }
    }

    function handleStateChange(eventTitle: mixed): void {
      if (runningStateChange) {
        queuedStateChange = eventTitle;
      } else {
        runningStateChange = stateChanger(eventTitle);
      }
    }

    shimHistory(w, events, handleStateChange);

    handleStateChange();

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
