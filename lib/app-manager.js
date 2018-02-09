// @flow

import AppManagerError from './utils/app-manager-error';
import { setNames, defaultGetAppNameFromUrl, getErrorStatusDetails, getLoadingStatusDetails, getDefaultStatusDetails } from './utils/config';
import shimHistory from './utils/shim-history';
import initGetPageFragments from './utils/get-page-fragments';
import initGetLifecycle from './utils/lifecycle';
import initGetState from './utils/get-state';

import type {
  EventsType,
  OverrideOptionsType,
  ConfigType,
  FragmentNameType,
  SlotNameType,
  StateType,
  StateChangeType,
  LifecycleType,
} from './index';

import type Window from './utils/window-stub';

import { DEFAULT_TIMEOUT, statuses, eventTitles, levels } from './constants';

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

    const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};
    let queuedStateChange: ?() => StateChangeType = null;

    const apps = setNames(config.apps);
    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);

    const defaultOptions = {
      haltOnError: false,
      importTimeout: DEFAULT_TIMEOUT,
      getAppNameFromUrl: defaultGetAppNameFromUrl(apps),
    };

    const options = Object.assign({}, defaultOptions, overrideOptions || {});

    const getState = initGetState(w, options, apps);
    const getPageFragments = initGetPageFragments(apps, fragments, slots);
    const getLifecycle = initGetLifecycle(w, options, apps, fragments, slots);

    async function handleError(slotName: SlotNameType, err: AppManagerError): Promise<void> {
      try {
        const handleErrorPromises = Object.keys(mountedLifecycles).map((errSlot) => mountedLifecycles[errSlot].throw(err));
        await Promise.all(handleErrorPromises);
      } catch (_) {
        // @TODO Script has already thrown
      } finally {
        events.emit(eventTitles.ERROR, err);
        events.emit(eventTitles.STATUS_CHANGE, getErrorStatusDetails(err));
      }
    }

    async function nextAction(slotName: SlotNameType): Promise<boolean> {
      try {
        const { value } = await mountedLifecycles[slotName].next(state);
        return value === true;
      } catch (err) {
        await handleError(slotName, err);
        return false;
      }
    }

    async function mountSlot(slotName: SlotNameType, fragmentName: ?FragmentNameType, initialRender: boolean): Promise<boolean> {
      const errData = {
        source: 'mount_slot',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      if (mountedLifecycles[slotName]) {
        await handleError(slotName, new AppManagerError('Overwriting an existing fragment.', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'overwrite_existing',
          recoverable: false,
        })));
      }

      if (fragmentName) {
        if (typeof fragments[fragmentName].loadScript !== 'function') {
          return false;
        }

        mountedLifecycles[slotName] = getLifecycle(state, fragmentName, slotName, initialRender);
      } else {
        delete mountedLifecycles[slotName];
      }

      return nextAction(slotName);
    }

    async function unmountSlot(slotName: SlotNameType): Promise<void> {
      const errData = {
        source: 'unmount_slot',
        fragment: null,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      await mountedLifecycles[slotName].next(state);

      await nextAction(slotName);

      const { done } = await mountedLifecycles[slotName].next(state);

      if (!done) {
        await handleError(slotName, new AppManagerError('Unmounting a fragment that is not finished.', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'not_finished',
          recoverable: false,
        })));
      }

      delete mountedLifecycles[slotName];
    }

    async function updatePage(initialRender: boolean): Promise<void> {
      const errData = {
        slot: null,
        fragment: null,
        source: 'update_page',
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      const newAppFragments = getPageFragments(state.app.name, state.path);

      const newAppSlots = Object.keys(newAppFragments);

      let slotsToMount = [];
      let slotsToUpdate = [];
      let slotsToUnmount = [];

      if (initialRender) {
        slotsToMount = newAppSlots.filter((slotName) => newAppFragments[slotName]);
      } else {
        if (!state.prevApp) {
          throw new AppManagerError(`No old app set when trying to mount ${state.app.name}`, Object.assign({}, errData, {
            level: levels.ERROR,
            code: 'no_previous_app',
            recoverable: false,
          }));
        }

        const oldAppFragments = getPageFragments(state.prevApp.name, state.path);
        const oldAppSlots = Object.keys(oldAppFragments);

        slotsToUpdate = oldAppSlots.filter((slotName) => {
          const fragmentName = oldAppFragments[slotName];
          return (
            fragmentName
            && mountedLifecycles[slotName]
            && newAppSlots.indexOf(slotName) > -1
            && newAppFragments[slotName] === fragmentName
          );
        });

        slotsToUnmount = oldAppSlots.filter((slotName) => {
          const fragmentName = oldAppFragments[slotName];
          return (
            fragmentName
            && mountedLifecycles[slotName]
            && (newAppSlots.indexOf(slotName) === -1 || newAppFragments[slotName] !== fragmentName)
          );
        });

        slotsToMount = newAppSlots.filter((slotName) => {
          const fragmentName = newAppFragments[slotName];
          return (
            fragmentName
            && (oldAppSlots.indexOf(slotName) === -1 || oldAppFragments[slotName] !== fragmentName)
          );
        });
      }

      events.emit(eventTitles.STATUS_CHANGE, getLoadingStatusDetails());

      await Promise.all(slotsToUnmount.map((slotName) => unmountSlot(slotName)));

      await Promise.all(slotsToUpdate.map((slotName) => nextAction(slotName)));

      const haveScripts = await Promise.all(slotsToMount.map((slotName) => mountSlot(slotName, newAppFragments[slotName], initialRender)));

      if (haveScripts.every(Boolean)) {
        await Promise.all(slotsToMount.map((slotName) => nextAction(slotName)));
      } else {
        events.emit(eventTitles.EXTERNAL_LINK);
      }

      events.emit(eventTitles.STATUS_CHANGE, getDefaultStatusDetails());
    }

    function getStateChanger(initialRender: boolean, eventTitle?: mixed) {
      return async function stateChanger(): Promise<void> {
        try {
          const currentApp = state ? state.app : null;
          const newState = await getState(currentApp, eventTitle);

          if (!newState) {
            events.emit(eventTitles.EXTERNAL_LINK);
            return;
          }

          state = newState;
        } catch (err) {
          events.emit(eventTitles.ERROR, err);
          return;
        }

        try {
          await updatePage(initialRender);
        } catch (err) {
          events.emit(eventTitles.ERROR, err);
          events.emit(eventTitles.STATUS_CHANGE, getErrorStatusDetails(err));
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
