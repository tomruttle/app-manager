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
  StatusDetailsType,
  EventsType,
  ScriptType,
  OptionsType,
  ConfigType,
  AppNameType,
  FragmentNameType,
  SlotNameType,
  EmitterType,
  RemoveListenerType,
  SubscriberType,
  StateType,
  ParamsType,
  QueryType,
} from './index';

import type Window from './utils/window-stub';

import { DOM_CHECK_INTERVAL, DEFAULT_TIMEOUT, statuses, eventTitles, levels } from './constants';

type LifecycleType = AsyncGenerator<ScriptType, null, StateType>;

type PageFragmentsType = { [slotName: SlotNameType]: ?FragmentNameType };

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

      if (!w.document || !w.location || !w.history) {
        throw new AppManagerError('Invalid window object. Aborting.', {
          source,
          code: 'invalid_environment',
          recoverable: false,
        });
      }

      const { apps, slots, fragments } = config || {};

      this._apps = setNames(apps);
      this._slots = setNames(slots);
      this._fragments = setNames(fragments);

      this._events = events;
      this._options = Object.assign({}, AppManager.defaultOptions, options || {});
      this._evaluatedPaths = evaluatePaths(this._apps);
    }

    _currentAppName: ?AppNameType = null;

    _cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

    _mountedLifecycles: { [slotName: SlotNameType]: { lifecycle: LifecycleType, done: boolean } } = {};

    _runningStateChanger: ?Promise<void> = null;

    _queuedStateChanger: ?() => Promise<void> = null;

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

    _getSlotElement = async (slotName: SlotNameType): Promise<?Element> => {
      const slot = this._slots[slotName];

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

      const slots = Object.keys(emptySlots).map((slotName) => this._slots[slotName]);

      if (!slots.every(Boolean)) {
        throw new AppManagerError(`App ${appName} tried to mount into at least one missing slot.`, {
          source,
          code: 'invalid_slots',
          recoverable: false,
          id: appName,
        });
      }

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

    _loadScript = async (state: StateType, fragmentName: FragmentNameType): Promise<ScriptType> => {
      const source = 'load_script';
      let script;

      try {
        script = await Promise.race([
          this._fragments[fragmentName].loadScript(state),
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

      return script;
    }

    _updateStatus = async (script: ScriptType, state: StateType, statusDetails: StatusDetailsType): Promise<void> => {
      if (script.version === 3) {
        return;
      }

      try {
        if (script.version === 4) {
          if (typeof script.onUpdateStatus === 'function') {
            await script.onUpdateStatus(statusDetails.status, this._apps[state.app.name]);
          }
        } else if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus(statusDetails, state);
        }
      } catch (err) {
        // @TODO Should these be ignored?
      }
    };

    _hydrate = async (script: ScriptType, state: StateType, fragmentName: FragmentNameType, slotElement: Element): Promise<void> => {
      const source = 'hydrate';

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
        throw new AppManagerError(err, {
          source,
          code: 'hydrate',
          recoverable: true,
          id: fragmentName,
          path: state.path,
        });
      }
    };

    _render = async (script: ScriptType, state: StateType, fragmentName: FragmentNameType, slotElement: Element): Promise<void> => {
      const source = 'render';

      try {
        if (script.version === 3) {
          await (script: ScriptVersion3Type).mount(slotElement, w.history, state.app);
        } else if (script.version === 4) {
          if (!state.event) {
            throw new AppManagerError(`Invalid state passed to unmount function for fragment ${fragmentName}`, {
              source,
              code: 'invalid_state',
              recoverable: true,
              id: fragmentName,
            });
          }

          await (script: ScriptVersion4Type).mount(slotElement, state.event, state.app);
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

    _onStateChange = async (script: ScriptType, state: StateType, fragmentName: FragmentNameType): Promise<void> => {
      const source = 'on_state_change';

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
        throw new AppManagerError(err, {
          source,
          code: 'on_state_change',
          recoverable: true,
          id: fragmentName,
        });
      }
    }

    _unmount = async (script: ScriptType, state: StateType, fragmentName: FragmentNameType, slotElement: Element): Promise<void> => {
      const source = 'unmount';
      const oldAppName = state.prevApp ? state.prevApp.name : null;
      const oldApp = oldAppName ? this._apps[oldAppName] : null;

      if (!oldApp) {
        throw new AppManagerError(`Invalid state passed to unmount function for fragment ${fragmentName}`, {
          source,
          code: 'invalid_state',
          recoverable: true,
          id: fragmentName,
        });
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

    async* _scriptLifecycle(initialState: StateType, fragmentName: FragmentNameType, slotName: SlotNameType, hydrate: boolean): LifecycleType {
      const source = 'script_lifecycle';

      let state = initialState;

      const loadingStatusDetails = this.constructor._getLoadingStatusDetails(source);
      const defaultStatusDetails = this.constructor._getDefaultStatusDetails(source);

      const cachedScript = this._cachedScripts[fragmentName];

      let script;

      if (cachedScript) {
        script = cachedScript;
      } else {
        script = await this._loadScript(state, fragmentName);

        this._cachedScripts[fragmentName] = script;
      }

      if (!script) {
        return null;
      }

      while (true) {
        try {
          state = yield script;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await this._updateStatus(script, state, this.constructor._getErrorStatusDetails(err));
        }
      }

      let slotElement = await this._getSlotElement(slotName);

      if (slotElement) {
        await this._updateStatus(script, state, loadingStatusDetails);

        if (hydrate) {
          await this._hydrate(script, state, fragmentName, slotElement);
        } else {
          await this._render(script, state, fragmentName, slotElement);
        }

        await this._updateStatus(script, state, defaultStatusDetails);
      }

      while (true) {
        try {
          state = yield script;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await this._updateStatus(script, state, this.constructor._getErrorStatusDetails(err));
        }
      }

      while (state) {
        await this._updateStatus(script, state, loadingStatusDetails);
        await this._onStateChange(script, state, fragmentName);
        await this._updateStatus(script, state, defaultStatusDetails);

        while (true) {
          try {
            state = yield script;
            break;
          } catch (err) {
            /* eslint-disable no-await-in-loop */
            await this._updateStatus(script, state, this.constructor._getErrorStatusDetails(err));
          }
        }
      }

      state = yield script;

      slotElement = await this._getSlotElement(slotName);

      if (slotElement) {
        await this._updateStatus(script, state, loadingStatusDetails);
        await this._unmount(script, state, fragmentName, slotElement);
        await this._updateStatus(script, state, defaultStatusDetails);
      }

      while (true) {
        try {
          yield script;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await this._updateStatus(script, state, this.constructor._getErrorStatusDetails(err));
        }
      }

      return null;
    }

    _handleError = async (slotName: SlotNameType, err: AppManagerError): Promise<void> => {
      const handleErrorPromises = Object.keys(this._mountedLifecycles)
        .filter((errSlot) => !this._mountedLifecycles[errSlot].done)
        .map((errSlot) => this._mountedLifecycles[errSlot].lifecycle.throw(err));

      await Promise.all(handleErrorPromises);

      this.emit(eventTitles.ERROR, err);
      this.emit(eventTitles.STATUS_CHANGE, this.constructor._getErrorStatusDetails(err));
    };

    _nextAction = async (slotName: SlotNameType, state: StateType): Promise<?ScriptType> => {
      try {
        const { done, value } = await this._mountedLifecycles[slotName].lifecycle.next(state);
        this._mountedLifecycles[slotName].done = done;
        return value;
      } catch (err) {
        this._mountedLifecycles[slotName].done = true;
        await this._handleError(slotName, err);
        return null;
      }
    };

    _mountSlot = async (slotName: SlotNameType, fragmentName: ?FragmentNameType, hydrate: boolean, state: StateType): Promise<boolean> => {
      const source = 'mount_slot';

      if (this._mountedLifecycles[slotName]) {
        await this._handleError(slotName, new AppManagerError('Overwriting an existing fragment.', {
          level: levels.WARNING,
          source,
        }));
      }

      if (fragmentName) {
        if (typeof this._fragments[fragmentName].loadScript !== 'function') {
          return false;
        }

        const lifecycle = this._scriptLifecycle(state, fragmentName, slotName, hydrate);
        this._mountedLifecycles[slotName] = { lifecycle, done: false };
      } else {
        delete this._mountedLifecycles[slotName];
      }

      const script = await this._nextAction(slotName, state);

      return Boolean(script && !this._mountedLifecycles[slotName].done);
    };

    _unmountSlot = async (slotName: SlotNameType, state: StateType): Promise<void> => {
      const source = 'unmount_slot';

      await this._mountedLifecycles[slotName].lifecycle.next();

      await this._nextAction(slotName, state);

      const { done } = await this._mountedLifecycles[slotName].lifecycle.next();

      if (!done) {
        await this._handleError(slotName, new AppManagerError('Unmounting a fragment that is not finished.', {
          level: levels.WARNING,
          source,
        }));
      }

      delete this._mountedLifecycles[slotName];
    };

    _updatePage = async (state: StateType, hydrate: boolean): Promise<void> => {
      const source = 'update_page';

      const newAppFragments = this._getPageFragments(state.app.name);

      const newAppSlots = Object.keys(newAppFragments);

      let slotsToMount = [];
      let slotsToUpdate = [];
      let slotsToUnmount = [];

      if (hydrate) {
        slotsToMount = newAppSlots.filter((slotName) => newAppFragments[slotName]);
      } else {
        if (!state.prevApp) {
          throw new AppManagerError(`No old app set when trying to mount ${state.app.name}`, {
            source,
            code: 'no_current_app',
            recoverable: true,
            id: state.app.name,
            path: state.path,
          });
        }

        const oldAppFragments = this._getPageFragments(state.prevApp.name);
        const oldAppSlots = Object.keys(oldAppFragments);

        slotsToUpdate = oldAppSlots.filter((slotName) => {
          const fragmentName = oldAppFragments[slotName];
          return (
            fragmentName
            && this._mountedLifecycles[slotName]
            && newAppSlots.indexOf(slotName) > -1
            && newAppFragments[slotName] === fragmentName
          );
        });

        slotsToUnmount = oldAppSlots.filter((slotName) => {
          const fragmentName = oldAppFragments[slotName];
          return (
            fragmentName
            && this._mountedLifecycles[slotName]
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

      this.emit(eventTitles.STATUS_CHANGE, this.constructor._getLoadingStatusDetails(source));

      await Promise.all(slotsToUnmount.map((slotName) => this._unmountSlot(slotName, state)));

      await Promise.all(slotsToUpdate.map((slotName) => this._nextAction(slotName, state)));

      const haveScripts = await Promise.all(slotsToMount.map((slotName) => this._mountSlot(slotName, newAppFragments[slotName], hydrate, state)));

      if (haveScripts.every(Boolean)) {
        await Promise.all(slotsToMount.map((slotName) => this._nextAction(slotName, state)));
      } else {
        this.emit(eventTitles.EXTERNAL_LINK);
      }

      this.emit(eventTitles.STATUS_CHANGE, this.constructor._getDefaultStatusDetails(source));
    }

    _getStateChanger = (hydrate: boolean, eventTitle?: mixed) => async (): Promise<void> => {
      const { pathname: path, search } = this.constructor._getBrowserLocation();

      try {
        const newAppName = getAppNameFromPath(this._evaluatedPaths, path);

        if (newAppName) {
          const oldAppName = this._currentAppName;

          const state = {
            event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
            path,
            params: this._getPathParams(newAppName, path),
            query: this.constructor._parseSearch(search),
            prevApp: oldAppName ? this._apps[oldAppName] : null,
            app: this._apps[newAppName],
          };

          this._currentAppName = newAppName;

          await this._updatePage(state, hydrate);
        } else {
          this.emit(eventTitles.EXTERNAL_LINK);

          // @TODO No idea why we need this line to clear the _runningStateChanger promise.
          await undefined;
        }
      } catch (err) {
        this.emit(eventTitles.ERROR, err);
        this.emit(eventTitles.STATUS_CHANGE, this.constructor._getErrorStatusDetails(err));
      }

      const queuedStateChange = this._queuedStateChanger;

      if (typeof queuedStateChange === 'function' && !this._options.haltOnError) {
        this._queuedStateChanger = null;
        this._runningStateChanger = queuedStateChange();
      } else {
        this._runningStateChanger = null;
      }
    };

    _handleStateChange = (eventTitle: mixed): void => {
      const stateChanger = this._getStateChanger(false, eventTitle);

      if (this._runningStateChanger) {
        this._queuedStateChanger = stateChanger;
      } else {
        this._runningStateChanger = stateChanger();
      }
    }

    init = (): void => {
      this._shimHistory();
      const stateChanger = this._getStateChanger(true);
      this._runningStateChanger = stateChanger();
    }
  };
}
