// @flow

import { delay, retry } from './utils/timers';
import AppManagerError from './utils/app-manager-error';
import { setNames } from './utils/config';
import initGetPageFragments from './utils/get-page-fragments';

import type {
  ScriptVersion3Type,
  ScriptVersion4Type,
  StatusDetailsType,
  EventsType,
  ScriptType,
  OptionsType,
  ConfigType,
  AppType,
  FragmentNameType,
  SlotNameType,
  StateType,
} from './index';

import type Window from './utils/window-stub';

import { DOM_CHECK_INTERVAL, DEFAULT_TIMEOUT, statuses, eventTitles, levels } from './constants';

type LifecycleType = AsyncGenerator<boolean, boolean, boolean>;

function getDefaultStatusDetails() {
  return {
    level: levels.INFO,
    status: statuses.DEFAULT,
  };
}

function getLoadingStatusDetails() {
  return {
    level: levels.INFO,
    status: statuses.LOADING,
  };
}

function getErrorStatusDetails(amError: AppManagerError) {
  return {
    level: amError.level || levels.ERROR,
    status: statuses.ERROR,
    message: amError.message,
  };
}

export default function initAppManager(w: Window) {
  function getBrowserLocation(): { pathname: string, search: string } {
    const errData = {
      source: 'get_browser_location',
      fragment: null,
      slot: null,
      app: null,
      path: null,
    };

    const { location } = w;

    if (!location || typeof location.pathname !== 'string') {
      throw new AppManagerError('Could not get location from browser.', Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'no_location',
        recoverable: false,
      }));
    }

    return location;
  }

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
  }

  function appManager(config: ConfigType, events: EventsType, overrideOptions?: OptionsType) {
    let runningStateChange: ?Promise<void> = null;
    let queuedStateChange: ?() => Promise<void> = null;
    let state: StateType;

    if (!w.document || !w.location || !w.history) {
      throw new AppManagerError('Invalid window object. Aborting.', {
        source: 'constructor',
        level: levels.ERROR,
        fragment: null,
        slot: null,
        app: null,
        path: null,
        code: 'invalid_environment',
        recoverable: false,
      });
    }

    const apps = setNames(config.apps);
    const slots = setNames(config.slots);
    const fragments = setNames(config.fragments);

    const defaultOptions = {
      haltOnError: false,
      importTimeout: DEFAULT_TIMEOUT,
      getAppNameFromLocation(location) {
        return Object.keys(apps).find((appName) => {
          const app = apps[appName];
          return Array.isArray(app.appPaths) ? app.appPaths.indexOf(location.pathname) !== -1 : location.pathname === app.appPath;
        });
      },
    };

    const options = Object.assign({}, defaultOptions, overrideOptions || {});
    const getPageFragments = initGetPageFragments(apps, fragments, slots);

    const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};
    const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};

    async function getState(prevApp: ?AppType, eventTitle?: mixed): Promise<?StateType> {
      const location = getBrowserLocation();

      const path = location.pathname;

      const errData = {
        source: 'set_state',
        fragment: null,
        slot: null,
        path,
      };

      let appName = null;

      if (typeof options.getAppNameFromLocation === 'function') {
        try {
          appName = await options.getAppNameFromLocation(location);
        } catch (err) {
          throw new AppManagerError(err, Object.assign({}, errData, {
            app: appName,
            level: levels.ERROR,
            code: 'get_app_name_from_location',
            recoverable: false,
          }));
        }
      }

      if (!appName) {
        return null;
      }

      let additionalState = {};

      if (typeof options.getAdditionalState === 'function') {
        try {
          additionalState = await options.getAdditionalState(appName, location);
        } catch (err) {
          throw new AppManagerError(err, Object.assign({}, errData, {
            app: appName,
            level: levels.ERROR,
            code: 'get_additional_state',
            recoverable: false,
          }));
        }
      }

      return Object.assign({}, additionalState, {
        event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
        path,
        prevApp,
        app: apps[appName],
      });
    }

    function emit(eventTitle, data) {
      if (events && typeof events.emit === 'function') {
        events.emit(eventTitle, data);
      }
    }

    function on(eventTitle, listener) {
      if (events && typeof events.on === 'function') {
        events.on(eventTitle, listener);
      }
    }

    function removeListener(eventTitle, listener) {
      if (events && typeof events.removeListener === 'function') {
        events.removeListener(eventTitle, listener);
      }
    }

    async function getSlotElement(slotName: SlotNameType): Promise<?Element> {
      const errData = {
        source: 'get_slot_element',
        fragment: null,
        slot: null,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      const slot = slots[slotName];

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
        throw new AppManagerError(`Element ${querySelector} not found for slot ${slot.name}.`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'element_not_found',
          recoverable: false,
        }));
      }

      return element;
    }

    async function loadScript(fragmentName: FragmentNameType, slotName: SlotNameType): Promise<ScriptType> {
      const errData = {
        source: 'load_script',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      let script;

      try {
        script = await Promise.race([
          fragments[fragmentName].loadScript(state),
          delay(options.importTimeout),
        ]);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'load_script',
          recoverable: true,
        }));
      }

      if (!script) {
        throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'time_out',
          recoverable: true,
        }));
      }

      if (!('version' in script)) {
        throw new AppManagerError(`Loaded script for fragment ${fragmentName} does not have a version property.`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'invalid_script',
          recoverable: true,
        }));
      }

      return script;
    }

    async function updateStatus(script: ScriptType, statusDetails: StatusDetailsType): Promise<void> {
      if (script.version === 3) {
        return;
      }

      try {
        if (script.version === 4) {
          if (typeof script.onUpdateStatus === 'function') {
            await script.onUpdateStatus(statusDetails.status, apps[state.app.name]);
          }
        } else if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus(statusDetails, state);
        }
      } catch (err) {
        // @TODO Should these be ignored?
      }
    }

    async function hydrate(script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
      const slotElement = await getSlotElement(slotName);

      const errData = {
        source: 'hydrate',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      if (!slotElement) {
        throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'element_not_found',
          recoverable: true,
        }));
      }

      try {
        if (script.version === 3) {
          await (script: ScriptVersion3Type).hydrate(slotElement, w.history, state.app);
        } else if (script.version === 4) {
          if (typeof script.hydrate === 'function') {
            await script.hydrate(slotElement, state.app);
          } else {
            await script.mount(slotElement, eventTitles.HISTORY_REPLACE_STATE, state.app);
          }
        } else if (typeof script.hydrate === 'function') {
          await script.hydrate(slotElement, state);
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'hydrate',
          recoverable: true,
        }));
      }
    }

    async function render(script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
      const slotElement = await getSlotElement(slotName);

      const errData = {
        source: 'render',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      if (!slotElement) {
        throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'element_not_found',
          recoverable: true,
        }));
      }

      try {
        if (script.version === 3) {
          await (script: ScriptVersion3Type).mount(slotElement, w.history, state.app);
        } else if (script.version === 4) {
          if (state.event) {
            await (script: ScriptVersion4Type).mount(slotElement, state.event, state.app);
          }
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'render',
          recoverable: true,
        }));
      }
    }

    async function onStateChange(script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
      const errData = {
        source: 'on_state_change',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      try {
        if (script.version === 3) {
          await script.onStateChange(w.history, state.app);
        } else if (script.version === 4) {
          if (typeof script.onStateChange === 'function') {
            if (state.event) {
              await script.onStateChange(state.event, state.app);
            }
          }
        } else if (typeof script.onStateChange === 'function') {
          await script.onStateChange(state);
        }
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'on_state_change',
          recoverable: true,
        }));
      }
    }

    async function unmount(script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
      const errData = {
        source: 'unmount',
        fragment: fragmentName,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      const slotElement = await getSlotElement(slotName);

      if (!slotElement) {
        throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'element_not_found',
          recoverable: true,
        }));
      }

      if (!state.prevApp) {
        throw new AppManagerError(`Invalid state at unmount for fragment ${fragmentName}`, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'invalid_state',
          recoverable: true,
        }));
      }

      try {
        if (script.version === 3) {
          await script.unmount(slotElement, w.history, state.prevApp);
        } else if (script.version === 4) {
          if (state.event) {
            await script.unmount(slotElement, state.event, state.prevApp);
          }
        } else if (typeof script.unmount === 'function') {
          await script.unmount(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'unmount',
          recoverable: true,
        }));
      }
    }

    async function* scriptLifecycle(fragmentName: FragmentNameType, slotName: SlotNameType, initialRender: boolean): LifecycleType {
      let statechange;

      const loadingStatusDetails = getLoadingStatusDetails();
      const defaultStatusDetails = getDefaultStatusDetails();

      const cachedScript = cachedScripts[fragmentName];

      let script;

      if (cachedScript) {
        script = cachedScript;
      } else {
        script = await loadScript(fragmentName, slotName);

        cachedScripts[fragmentName] = script;
      }

      if (!script) {
        return false;
      }

      while (!statechange) {
        try {
          statechange = yield true;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await updateStatus(script, getErrorStatusDetails(err));
        }
      }

      await updateStatus(script, loadingStatusDetails);

      if (initialRender) {
        await hydrate(script, fragmentName, slotName);
      } else {
        await render(script, fragmentName, slotName);
      }

      await updateStatus(script, defaultStatusDetails);

      while (!statechange) {
        try {
          statechange = yield true;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await updateStatus(script, getErrorStatusDetails(err));
        }
      }

      while (!statechange) {
        await updateStatus(script, loadingStatusDetails);
        await onStateChange(script, fragmentName, slotName);
        await updateStatus(script, defaultStatusDetails);

        while (true) {
          try {
            statechange = yield true;
            break;
          } catch (err) {
            /* eslint-disable no-await-in-loop */
            await updateStatus(script, getErrorStatusDetails(err));
          }
        }
      }

      yield true;

      await updateStatus(script, loadingStatusDetails);
      await unmount(script, fragmentName, slotName);
      await updateStatus(script, defaultStatusDetails);

      while (!statechange) {
        try {
          statechange = yield true;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await updateStatus(script, getErrorStatusDetails(err));
        }
      }

      return false;
    }

    async function handleError(slotName: SlotNameType, err: AppManagerError): Promise<void> {
      try {
        const handleErrorPromises = Object.keys(mountedLifecycles).map((errSlot) => mountedLifecycles[errSlot].throw(err));
        await Promise.all(handleErrorPromises);
      } catch (_) {
        // @TODO Script has already thrown
      } finally {
        emit(eventTitles.ERROR, err);
        emit(eventTitles.STATUS_CHANGE, getErrorStatusDetails(err));
      }
    }

    async function nextAction(slotName: SlotNameType): Promise<boolean> {
      try {
        const { value } = await mountedLifecycles[slotName].next(true);
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

        mountedLifecycles[slotName] = scriptLifecycle(fragmentName, slotName, initialRender);
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

      await mountedLifecycles[slotName].next(true);

      await nextAction(slotName);

      const { done } = await mountedLifecycles[slotName].next(true);

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

      emit(eventTitles.STATUS_CHANGE, getLoadingStatusDetails());

      await Promise.all(slotsToUnmount.map((slotName) => unmountSlot(slotName)));

      await Promise.all(slotsToUpdate.map((slotName) => nextAction(slotName)));

      const haveScripts = await Promise.all(slotsToMount.map((slotName) => mountSlot(slotName, newAppFragments[slotName], initialRender)));

      if (haveScripts.every(Boolean)) {
        await Promise.all(slotsToMount.map((slotName) => nextAction(slotName)));
      } else {
        emit(eventTitles.EXTERNAL_LINK);
      }

      emit(eventTitles.STATUS_CHANGE, getDefaultStatusDetails());
    }

    function getStateChanger(initialRender: boolean, eventTitle?: mixed) {
      return async function stateChanger(): Promise<void> {
        try {
          const currentApp = state ? state.app : null;
          const newState = await getState(currentApp, eventTitle);

          if (!newState) {
            emit(eventTitles.EXTERNAL_LINK);
            return;
          }

          state = newState;
        } catch (err) {
          emit(eventTitles.ERROR, err);
          return;
        }

        try {
          await updatePage(initialRender);
        } catch (err) {
          emit(eventTitles.ERROR, err);
          emit(eventTitles.STATUS_CHANGE, getErrorStatusDetails(err));
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

    (function shimHistory() {
      /* eslint-disable no-param-reassign */

      const { onpopstate, onbeforeunload } = w;
      const { pushState, replaceState } = w.history;

      w.history.pushState = (...args) => {
        if (typeof pushState === 'function') {
          pushState.apply(w.history, args);
        }

        emit(eventTitles.HISTORY_PUSH_STATE);
        emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_PUSH_STATE);
      };

      w.history.replaceState = (...args) => {
        if (typeof replaceState === 'function') {
          replaceState.apply(w.history, args);
        }

        emit(eventTitles.HISTORY_REPLACE_STATE);
        emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_REPLACE_STATE);
      };

      // $FlowFixMe
      w.history.getState = () => ({
        data: w.history.state,
        title: w.document.title,
        url: w.location.href,
        hash: `${w.location.pathname}${w.location.search || ''}`,
      });

      w.onpopstate = (...args) => {
        if (typeof onpopstate === 'function') {
          onpopstate.apply(w.history, args);
        }

        emit(eventTitles.HISTORY_POP_STATE);
        emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_POP_STATE);
      };

      w.onbeforeunload = (...args) => {
        if (typeof onbeforeunload === 'function') {
          onbeforeunload.apply(w.history, args);
        }

        removeListener(eventTitles.HISTORY_STATE_CHANGE, handleStateChange);

        w.onpopstate = onpopstate;
        w.history.pushState = pushState;
        w.history.replaceState = replaceState;
      };

      on(eventTitles.HISTORY_STATE_CHANGE, handleStateChange);
    }());

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
