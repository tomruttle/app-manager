// @flow

import slotFinder from 'slot-finder';
import qs from 'qs';

import { evaluatePaths, getAppNameFromPath, evalPathParams } from './utils/path';
import { delay, retry } from './utils/timers';
import AppManagerError from './utils/app-manager-error';
import { setNames } from './utils/config';

import type {
  AppManagerInterface,
  ScriptVersion3Type,
  ScriptVersion4Type,
  EventsType,
  ScriptType,
  OptionsType,
  ConfigType,
  AppNameType,
  FragmentNameType,
  SlotNameType,
  EventTitleType,
  EmitterType,
  RemoveListenerType,
  SubscriberType,
  SlotType,
  StateType,
  ParamsType,
  QueryType,
  StatusDetailsType,
} from './index';

import type Window from './utils/window-stub';

import { DOM_CHECK_INTERVAL, DEFAULT_TIMEOUT, statuses, eventTitles, levels } from './constants';

type LifecycleType = AsyncGenerator<*, *, *>;

type PageFragmentsType = { [slotName: SlotNameType]: FragmentNameType };

export default function initAppManager(w: Window) {
  return class AppManager implements AppManagerInterface {
    static statuses = statuses;
    static eventTitles = eventTitles;
    static levels = levels;

    static defaultOptions = {
      haltOnError: false,
      importTimeout: DEFAULT_TIMEOUT,
    };

    static _getDefaultStatusDetails(source: string) {
      return {
        level: levels.INFO,
        status: statuses.DEFAULT,
        source,
      };
    }

    static _getLoadingStatusDetails(source: string) {
      return {
        level: levels.INFO,
        status: statuses.LOADING,
        source,
      };
    }

    static _getErrorStatusDetails(amError: AppManagerError) {
      return {
        level: amError.level || levels.ERROR,
        status: statuses.ERROR,
        source: amError.source,
        message: amError.message,
      };
    }

    static _getBrowserLocation(): { pathname: string, search: string } {
      const source = 'get_browser_location';
      const { location } = w;

      if (!location || typeof location.pathname !== 'string') {
        throw new AppManagerError('Could not get location from browser.', {
          source,
          code: 'no_location',
          recoverable: true,
        });
      }

      return location;
    }

    static _parseSearch(search: string): QueryType {
      return qs.parse(search, { ignoreQueryPrefix: true });
    }

    static _querySelector(querySelector: string): ?Element {
      return w.document.querySelector(querySelector);
    }

    _apps: *;
    _slots: *;
    _fragments: *;
    _options: *;
    _events: *;
    _evaluatedPaths: *;

    constructor(config: ConfigType, events: EventsType, options?: OptionsType) {
      const source = 'constructor';
      const { pathname: path } = AppManager._getBrowserLocation();

      if (!config) {
        throw new AppManagerError('Config not specified. Aborting.', {
          source,
          code: 'invalid_config',
          recoverable: false,
          path,
        });
      }

      if (!w.document || !w.location || !w.history) {
        throw new AppManagerError('Invalid window object. Aborting.', {
          source,
          code: 'invalid_environment',
          recoverable: false,
          path,
        });
      }

      const { apps, slots, fragments } = config;

      this._apps = setNames(apps);
      this._slots = setNames(slots);
      this._fragments = setNames(fragments);

      this._events = events;
      this._options = Object.assign({}, AppManager.defaultOptions, options || {});
      this._evaluatedPaths = evaluatePaths(this._apps);
    }

    _currentAppName: ?AppNameType = null;

    _cachedScripts: { [fragmentName: FragmentNameType]: ?ScriptType } = {};

    _mountedLifecycles: { [slotName: SlotNameType]: { lifecycle: LifecycleType, done: boolean } } = {};

    _runningStateChange: ?Promise<void> = null;

    _queuedStateChange: ?() => Promise<void> = null;

    emit: EmitterType = (eventTitle, data) => {
      if (this._events && typeof this._events.emit === 'function') {
        this._events.emit(eventTitle, data);
      }
    }

    on: SubscriberType = (eventTitle, listener) => {
      if (this._events && typeof this._events.on === 'function') {
        this._events.on(eventTitle, listener);
      }
    }

    removeListener: RemoveListenerType = (eventTitle, listener) => {
      if (this._events && typeof this._events.removeListener === 'function') {
        this._events.removeListener(eventTitle, listener);
      }
    }

    _runStateChanger = (stateChanger: (...Array<any>) => any, ...args: Array<any>): void => {
      const stateChange = async (): Promise<void> => {
        const source = 'state_change';

        try {
          this.emit(eventTitles.STATUS_CHANGE, this.constructor._getLoadingStatusDetails(source));

          await stateChanger(...args);

          this.emit(eventTitles.STATUS_CHANGE, this.constructor._getDefaultStatusDetails(source));
        } catch (err) {
          const amError = new AppManagerError(err);

          this.emit(eventTitles.ERROR, amError);
          this.emit(eventTitles.STATUS_CHANGE, this.constructor._getErrorStatusDetails(amError));
        }

        const queuedStateChange = this._queuedStateChange;

        if (typeof queuedStateChange === 'function' && !this._options.haltOnError) {
          this._queuedStateChange = null;
          this._runningStateChange = queuedStateChange();
        } else {
          this._runningStateChange = null;
        }
      };

      if (this._runningStateChange) {
        this._queuedStateChange = stateChange;
      } else {
        this._runningStateChange = stateChange();
      }
    }

    _getPathParams = (appName: AppNameType, path: string): ParamsType => {
      const source = 'get_path_params';

      const evaluatedPath = this._evaluatedPaths[appName];

      const params = evalPathParams(evaluatedPath, path);

      if (!params) {
        throw new AppManagerError('Browser path does not match current app.', {
          source,
          recoverable: true,
          code: 'invalid_path',
        });
      }

      return params;
    }

    _getSlotElement = async (slot: SlotType): Promise<?Element> => {
      const source = 'get_slot_element';
      const { querySelector } = slot;

      if (!querySelector) {
        return null;
      }

      const element = await retry(
        () => this.constructor._querySelector(querySelector),
        DOM_CHECK_INTERVAL,
        this._options.importTimeout,
      );

      if (!element) {
        throw new AppManagerError(`Element ${querySelector} not found for slot ${slot.name}.`, {
          source,
          code: 'element_not_found',
          recoverable: true,
          id: slot.name,
        });
      }

      return element;
    }

    _getFragmentScript = async (fragmentName: FragmentNameType, state: StateType): Promise<?ScriptType> => {
      const source = 'load_fragment_script';

      const cachedScript = this._cachedScripts[fragmentName];

      if (cachedScript) {
        return cachedScript;
      }

      const fragment = this._fragments[fragmentName];

      if (!fragment) {
        throw new AppManagerError(`Tried to load invalid fragment ${fragmentName}.`, {
          source,
          code: 'fragment_not_found',
          recoverable: false,
          id: fragmentName,
        });
      }

      if (typeof fragment.loadScript !== 'function') {
        this._cachedScripts[fragmentName] = null;
        return null;
      }

      let script;

      try {
        script = await Promise.race([
          fragment.loadScript(state),
          delay(this._options.importTimeout),
        ]);
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'load_script',
          recoverable: true,
          id: fragmentName,
        });
      }

      if (!script) {
        throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, {
          source,
          code: 'time_out',
          recoverable: true,
          id: fragmentName,
        });
      }

      if (!('version' in script)) {
        throw new AppManagerError(`Loaded script for fragment ${fragmentName} does not have a version property.`, {
          source,
          code: 'invalid_script',
          recoverable: false,
          id: fragmentName,
        });
      }

      this._cachedScripts[fragmentName] = script;

      return script;
    }

    _getPageFragments = (appName: AppNameType): PageFragmentsType => {
      const source = 'get_page_fragments';
      const app = this._apps[appName];

      if (!Array.isArray(app.fragments)) {
        throw new AppManagerError(`App ${appName} does not have a fragments array`, {
          source,
          code: 'invalid_app',
          recoverable: false,
          id: appName,
        });
      }

      const appFragments = app.fragments.map((fragmentName) => this._fragments[fragmentName]);

      if (!appFragments.every(Boolean)) {
        throw new AppManagerError(`App ${appName} tried to mount at least one missing fragment.`, {
          source,
          code: 'missing_fragment',
          recoverable: false,
          id: appName,
        });
      }

      const emptySlots = appFragments
        .reduce((slots, fragment) => slots.concat(fragment.slots), [])
        .reduce((empty, slotName) => Object.assign(empty, { [slotName]: null }), {});

      let pageFragments;

      try {
        pageFragments = slotFinder(emptySlots, appFragments);
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'slot_finder',
          recoverable: true,
          id: appName,
        });
      }

      if (!pageFragments || typeof pageFragments !== 'object') {
        throw new AppManagerError(`SlotFinder returned invalid fragments for app ${appName}`, {
          source,
          code: 'get_fragments',
          recoverable: false,
          id: appName,
        });
      }

      return pageFragments;
    };

    _getState = (path: string, search: string, appName: AppNameType, eventTitle: ?EventTitleType = null): StateType => ({
      event: eventTitle,
      path,
      params: this._getPathParams(appName, path),
      query: this.constructor._parseSearch(search),
      prevApp: this._currentAppName ? this._apps[this._currentAppName] : null,
      app: this._apps[appName],
    });

    _hydrate = async (fragmentName: FragmentNameType, slotName: SlotNameType, state: StateType): Promise<?void> => {
      const source = 'hydrate';
      const appName = state.app.name;
      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${fragmentName} tried to mount into non-existent slot ${slotName}`, {
          source,
          code: 'invalid_slot',
          recoverable: false,
          id: fragmentName,
        });
      }

      const slotElement = await this._getSlotElement(slot);

      if (!slotElement) {
        return;
      }

      const app = this._apps[appName];

      const script = await this._getFragmentScript(fragmentName, state);

      if (!script) {
        return;
      }

      try {
        if (script.version === 3) {
          await (script: ScriptVersion3Type).hydrate(slotElement, w.history, app);
        } else if (script.version === 4) {
          if (typeof script.hydrate === 'function') {
            await script.hydrate(slotElement, app);
          } else {
            await script.mount(slotElement, eventTitles.HISTORY_REPLACE_STATE, app);
          }
        } else if (typeof script.hydrate === 'function') {
          await script.hydrate(slotElement, state);
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'hydrate',
          recoverable: true,
          id: fragmentName,
        });
      }
    }

    _unmount = async (fragmentName: FragmentNameType, slotName: SlotNameType, state: StateType): Promise<?void> => {
      const source = 'unmount';
      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${fragmentName} tried to unmount from non-existent slot ${slotName}`, {
          source,
          code: 'invalid_slot',
          recoverable: false,
          id: fragmentName,
        });
      }

      const slotElement = await this._getSlotElement(slot);

      if (!slotElement) {
        return;
      }

      const oldAppName = state.prevApp ? state.prevApp.name : null;
      const oldApp = oldAppName ? this._apps[oldAppName] : null;

      if (!oldApp || !state.event) {
        throw new AppManagerError(`Invalid state passed to unmount function for fragment ${fragmentName}`, {
          source,
          code: 'invalid_state',
          recoverable: true,
          id: fragmentName,
        });
      }

      const script = await this._getFragmentScript(fragmentName, state);

      if (!script) {
        return;
      }

      try {
        if (script.version === 3) {
          await script.unmount(slotElement, w.history, oldApp);
        } else if (script.version === 4) {
          if (state.event) {
            await script.unmount(slotElement, state.event, oldApp);
          }
        } else if (typeof script.unmount === 'function') {
          await script.unmount(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'unmount',
          recoverable: true,
          id: fragmentName,
        });
      }
    }

    _render = async (fragmentName: FragmentNameType, slotName: SlotNameType, state: StateType): Promise<void> => {
      const source = 'render';
      const appName = state.app.name;

      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${fragmentName} tried to mount into non-existent slot ${slotName}`, {
          source,
          code: 'invalid_slot',
          recoverable: false,
          id: fragmentName,
        });
      }

      const slotElement = await this._getSlotElement(slot);

      if (!slotElement) {
        return;
      }

      const app = this._apps[appName];

      const script = await this._getFragmentScript(fragmentName, state);

      if (!script) {
        return;
      }

      try {
        if (script.version === 3) {
          await (script: ScriptVersion3Type).mount(slotElement, w.history, app);
        } else if (script.version === 4) {
          if (!state.event) {
            throw new AppManagerError(`Invalid state passed to unmount function for fragment ${fragmentName}`, {
              source,
              code: 'invalid_state',
              recoverable: true,
              id: fragmentName,
            });
          }

          await (script: ScriptVersion4Type).mount(slotElement, state.event, app);
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'render',
          recoverable: true,
          id: fragmentName,
        });
      }
    }

    _onStateChange = async (fragmentName: FragmentNameType, state: StateType): Promise<void> => {
      const source = 'on_state_change';
      const appName = state.app.name;
      const app = this._apps[appName];

      const script = await this._getFragmentScript(fragmentName, state);

      if (!script) {
        return;
      }

      try {
        if (script.version === 3) {
          await script.onStateChange(w.history, app);
        } else if (script.version === 4) {
          if (typeof script.onStateChange === 'function') {
            if (!state.event) {
              throw new AppManagerError(`Invalid state passed to unmount function for fragment ${fragmentName}`, {
                source,
                code: 'invalid_state',
                recoverable: true,
                id: fragmentName,
              });
            }

            await script.onStateChange(state.event, app);
          }
        } else if (typeof script.onStateChange === 'function') {
          await script.onStateChange(state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'on_state_change',
          recoverable: true,
          id: fragmentName,
        });
      }
    }

    _onUpdateStatus = async (fragmentName: FragmentNameType, state: StateType, statusDetails: StatusDetailsType): Promise<void> => {
      const source = 'on_update_status';

      const script = await this._getFragmentScript(fragmentName, state);

      if (!script || script.version === 3) {
        return;
      }

      const app = this._apps[state.app.name];

      try {
        if (script.version === 4) {
          if (typeof script.onUpdateStatus === 'function') {
            await script.onUpdateStatus(statusDetails.status, app);
          }
        } else if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus(statusDetails, state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source,
          code: 'on_update_status',
          id: fragmentName,
        });
      }
    };

    _updatePage = async (eventTitle: mixed, path: string, search: string): Promise<void> => {
      const source = 'update_page';

      if (typeof eventTitle !== 'string') {
        throw new AppManagerError(`Invalid eventTitle ${String(eventTitle)} emitted.`, {
          source,
          recoverable: true,
          code: 'invalid_event_title',
        });
      }

      const newAppName = getAppNameFromPath(this._evaluatedPaths, path);

      if (!newAppName) {
        this.emit(eventTitles.EXTERNAL_LINK);
        return;
      }

      const state = this._getState(path, search, newAppName, eventTitle);

      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        throw new AppManagerError(`No old app set when trying to mount ${newAppName}`, {
          source,
          code: 'no_current_app',
          recoverable: true,
          id: newAppName,
        });
      }

      const oldAppFragments = this._getPageFragments(oldAppName);
      const newAppFragments = this._getPageFragments(newAppName);

      const oldAppSlots = Object.keys(oldAppFragments);
      const newAppSlots = Object.keys(newAppFragments);

      const unmount = oldAppSlots.filter((slotName) => newAppSlots.indexOf(slotName) === -1 || newAppFragments[slotName] !== oldAppFragments[slotName]);
      const onStateChange = oldAppSlots.filter((slotName) => newAppSlots.indexOf(slotName) > -1 && newAppFragments[slotName] === oldAppFragments[slotName]);
      const render = newAppSlots.filter((slotName) => oldAppSlots.indexOf(slotName) === -1 || newAppFragments[slotName] !== oldAppFragments[slotName]);

      const handleError = async (slotName, err) => {
        this._mountedLifecycles[slotName].done = true;

        const handleErrorPromises = Object.keys(this._mountedLifecycles)
          .filter((errSlot) => !this._mountedLifecycles[errSlot].done)
          .map((errSlot) => this._mountedLifecycles[errSlot].lifecycle.throw(err));

        await Promise.all(handleErrorPromises);

        this.emit(eventTitles.ERROR, err);
        this.emit(eventTitles.STATUS_CHANGE, this.constructor._getErrorStatusDetails(err));
      };

      const unmountPromises = unmount.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next();

          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      await Promise.all(unmountPromises);

      render.forEach((slotName) => {
        this._mountedLifecycles[slotName] = { lifecycle: this._scriptLifecycle(newAppFragments[slotName], slotName, false), done: false };
        this._mountedLifecycles[slotName].lifecycle.next(state);
      });

      const loadPageScriptsPromises = render.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      await Promise.all(loadPageScriptsPromises);

      const haveScripts = await Promise.all(render.map(async (slotName) => {
        const { done, value } = await this._mountedLifecycles[slotName].lifecycle.next();
        return Boolean(!done && value);
      }));

      if (!haveScripts.every(Boolean)) {
        this.emit(eventTitles.EXTERNAL_LINK);
        return;
      }

      const onStateChangePromises = onStateChange.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      const renderScriptPromises = render.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      await Promise.all([...onStateChangePromises, ...renderScriptPromises]);

      this._currentAppName = newAppName;
    }

    _handleStateChange = async (eventTitle: mixed): Promise<void> => {
      const { pathname, search } = this.constructor._getBrowserLocation();
      this._runStateChanger(this._updatePage, eventTitle, pathname, search);
    }

    _shimHistory = () => {
      /* eslint-disable no-param-reassign */

      const { onpopstate, onbeforeunload } = w;
      const { pushState, replaceState } = w.history;

      w.history.pushState = (...args) => {
        if (typeof pushState === 'function') {
          pushState.apply(w.history, args);
        }

        this.emit(eventTitles.HISTORY_PUSH_STATE);
        this.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_PUSH_STATE);
      };

      w.history.replaceState = (...args) => {
        if (typeof replaceState === 'function') {
          replaceState.apply(w.history, args);
        }

        this.emit(eventTitles.HISTORY_REPLACE_STATE);
        this.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_REPLACE_STATE);
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

        this.emit(eventTitles.HISTORY_POP_STATE);
        this.emit(eventTitles.HISTORY_STATE_CHANGE, eventTitles.HISTORY_POP_STATE);
      };

      w.onbeforeunload = (...args) => {
        if (typeof onbeforeunload === 'function') {
          onbeforeunload.apply(w.history, args);
        }

        this.removeListener(eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);

        w.onpopstate = onpopstate;
        w.history.pushState = pushState;
        w.history.replaceState = replaceState;
      };

      this.on(eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);
    }

    async* _yieldErrors(fragmentName: FragmentNameType, state: StateType): AsyncGenerator<*, *, *> {
      while (true) {
        try {
          const value = yield;
          return value;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await this._onUpdateStatus(fragmentName, state, this.constructor._getErrorStatusDetails(err));
        }
      }
    }

    async* _scriptLifecycle(fragmentName: FragmentNameType, slotName: SlotNameType, hydrate: boolean = true): LifecycleType {
      const source = 'script_lifecycle';

      const loadingStatusDetails = this.constructor._getLoadingStatusDetails(source);
      const defaultStatusDetails = this.constructor._getDefaultStatusDetails(source);

      const getScriptState = yield;

      await this._onUpdateStatus(fragmentName, getScriptState, loadingStatusDetails);
      const script = await this._getFragmentScript(fragmentName, getScriptState);
      await this._onUpdateStatus(fragmentName, getScriptState, defaultStatusDetails);

      yield* this._yieldErrors(fragmentName, getScriptState);

      const mountState = yield script;

      await this._onUpdateStatus(fragmentName, mountState, loadingStatusDetails);

      if (hydrate) {
        await this._hydrate(fragmentName, slotName, mountState);
      } else {
        await this._render(fragmentName, slotName, mountState);
      }

      await this._onUpdateStatus(fragmentName, mountState, defaultStatusDetails);

      let statechangeState = yield* this._yieldErrors(fragmentName, mountState);

      while (statechangeState) {
        await this._onUpdateStatus(fragmentName, statechangeState, loadingStatusDetails);
        await this._onStateChange(fragmentName, statechangeState);
        await this._onUpdateStatus(fragmentName, statechangeState, defaultStatusDetails);

        statechangeState = yield* this._yieldErrors(fragmentName, statechangeState);
      }

      const unmountState = yield;

      await this._onUpdateStatus(fragmentName, unmountState, loadingStatusDetails);
      await this._unmount(fragmentName, slotName, unmountState);
      await this._onUpdateStatus(fragmentName, unmountState, defaultStatusDetails);

      yield* this._yieldErrors(fragmentName, unmountState);

      return null;
    }

    _setupPage = async (path: string, search: string): Promise<void> => {
      const currentAppName = getAppNameFromPath(this._evaluatedPaths, path);

      if (!currentAppName) {
        this.emit(eventTitles.EXTERNAL_LINK);
        return;
      }

      this._currentAppName = currentAppName;

      const state = this._getState(path, search, currentAppName);

      const pageFragments = this._getPageFragments(state.app.name);

      const pageSlots = Object.keys(pageFragments);

      pageSlots.forEach((slotName) => {
        this._mountedLifecycles[slotName] = { lifecycle: this._scriptLifecycle(pageFragments[slotName], slotName), done: false };
        this._mountedLifecycles[slotName].lifecycle.next();
      });

      const handleError = async (slotName, err) => {
        this._mountedLifecycles[slotName].done = true;

        const handleErrorPromises = Object.keys(this._mountedLifecycles)
          .filter((errSlot) => !this._mountedLifecycles[errSlot].done)
          .map((errSlot) => this._mountedLifecycles[errSlot].lifecycle.throw(err));

        await Promise.all(handleErrorPromises);

        this.emit(eventTitles.ERROR, err);
        this.emit(eventTitles.STATUS_CHANGE, this.constructor._getErrorStatusDetails(err));
      };

      const loadPageScripts = pageSlots.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      await Promise.all(loadPageScripts);

      const haveScripts = await Promise.all(pageSlots.map(async (slotName) => {
        const { done, value } = await this._mountedLifecycles[slotName].lifecycle.next();
        return Boolean(!done && value);
      }));

      if (!haveScripts.every(Boolean)) {
        this.emit(eventTitles.EXTERNAL_LINK);
        return;
      }

      const hydratePageFragments = pageSlots.map(async (slotName) => {
        try {
          await this._mountedLifecycles[slotName].lifecycle.next(state);
        } catch (err) {
          await handleError(slotName, err);
        }
      });

      await Promise.all(hydratePageFragments);
    }

    init = (): void => {
      this._shimHistory();

      const { pathname, search } = this.constructor._getBrowserLocation();
      this._runStateChanger(this._setupPage, pathname, search);
    }
  };
}
