// @flow

import slotFinder from 'slot-finder';
import qs from 'qs';

import { evaluatePaths, getAppNameFromPath, evalPathParams } from './utils/path';
import { delay, retry } from './utils/timers';
import AppManagerError from './utils/app-manager-error';

import type {
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

import { DOM_CHECK_INTERVAL, statuses, eventTitles, levels } from './constants';

type ResolvedFragmentType = {
  script: ScriptType,
  slotName: SlotNameType,
  fragmentName: FragmentNameType,
};

export default function initAppManager(w: Window) {
  return class AppManager {
    static statuses = statuses;
    static eventTitles = eventTitles;
    static levels = levels;

    static _getBrowserPath(): string {
      const source = 'get_browser_path';
      const path = w.location.pathname;

      if (!path || typeof path !== 'string') {
        throw new AppManagerError('Could not get path from browser.', {
          source,
          code: 'no_path',
          recoverable: true,
        });
      }

      return path;
    }

    static _getQuery(): QueryType {
      return qs.parse(w.location.search, { ignoreQueryPrefix: true });
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

    constructor(config: ConfigType, events: EventsType, options: OptionsType = {}) {
      const source = 'constructor';

      if (!config) {
        throw new AppManagerError('Config not specified. Aborting.', {
          source,
          code: 'invalid_config',
          recoverable: false,
          path: AppManager._getBrowserPath(),
        });
      }

      if (!w.document || !w.location || !w.history) {
        throw new AppManagerError('Invalid window object. Aborting.', {
          source,
          code: 'invalid_environment',
          recoverable: false,
          path: AppManager._getBrowserPath(),
        });
      }

      const { apps, slots, fragments } = config;

      this._apps = apps;
      this._slots = slots;
      this._fragments = fragments;
      this._events = events;
      this._options = options;
      this._evaluatedPaths = evaluatePaths(this._apps);
    }

    _status: $Values<typeof AppManager.statuses> = this.constructor.statuses.UNINITIALISED;

    _currentAppName: ?AppNameType = null;

    _resolvedFragments: { [fragmentName: FragmentNameType]: ?ResolvedFragmentType } = {};

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

    _getAppNameFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      return getAppNameFromPath(this._evaluatedPaths, path);
    }

    _getPathParams = (appName: AppNameType): ParamsType => {
      const source = 'get_path_params';
      const path = this.constructor._getBrowserPath();

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

    _loadFragmentScript = async (fragmentName: FragmentNameType, state: StateType): Promise<ScriptType> => {
      const source = 'load_fragment_script';
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
        throw new AppManagerError(`Fragment ${fragmentName} does not have a loadScript function.`, {
          source,
          code: 'invalid_fragment',
          recoverable: false,
          id: fragmentName,
        });
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

      return script;
    }

    _resolveFragment = async (slotName: SlotNameType, fragmentName: FragmentNameType, state: StateType): Promise<?ResolvedFragmentType> => {
      if (fragmentName in this._resolvedFragments) {
        return this._resolvedFragments[fragmentName];
      }

      const fragment = this._fragments[fragmentName];

      let resolvedFragment;

      if (fragment && fragment.loadScript) {
        const script = await this._loadFragmentScript(fragmentName, state);

        resolvedFragment = { script, slotName, fragmentName };
      } else {
        resolvedFragment = null;
      }

      this._resolvedFragments[fragmentName] = resolvedFragment;

      return resolvedFragment;
    };

    _resolveAppFragments = async (appName: AppNameType, state: StateType): Promise<{ [slotName: SlotNameType]: ?ResolvedFragmentType }> => {
      const source = 'resolve_page_fragments';
      const app = this._apps[appName];

      if (!Array.isArray(app.fragments)) {
        throw new AppManagerError(`App ${appName} does not have a fragments array`, {
          source,
          code: 'invalid_app',
          recoverable: false,
          id: appName,
        });
      }

      const appFragments = app.fragments
        .map((fragmentName) => this._fragments[fragmentName]);

      if (!appFragments.every(Boolean)) {
        throw new AppManagerError(`App ${appName} tries to mount at least one missing fragment.`, {
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

      const pageSlots = Object.keys(pageFragments);

      const resolveFragmentPromises = pageSlots.map((slotName) => this._resolveFragment(slotName, pageFragments[slotName], state));

      const resolvedFragments = await Promise.all(resolveFragmentPromises);

      return pageSlots.reduce((resolvedFragmentsMap, slotName, index) => Object.assign({}, resolvedFragmentsMap, {
        [slotName]: resolvedFragments[index],
      }), {});
    };

    _getState = (appName: AppNameType, eventTitle: ?EventTitleType = null): StateType => ({
      event: eventTitle,
      path: this.constructor._getBrowserPath(),
      params: this._getPathParams(appName),
      query: this.constructor._getQuery(),
      prevApp: this._currentAppName ? this._apps[this._currentAppName] : null,
      app: this._apps[appName],
    });

    _hydrate = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<?void> => {
      const source = 'hydrate';
      const { script, fragmentName, slotName } = resolvedFragment;
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

    _unmount = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<?void> => {
      const source = 'unmount';
      const { script, fragmentName, slotName } = resolvedFragment;

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

      try {
        if (script.version === 3) {
          await script.unmount(slotElement, w.history, oldApp);
        } else if (script.version === 4) {
          await script.unmount(slotElement, state.event, oldApp);
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

    _render = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const source = 'render';
      const { script, fragmentName, slotName } = resolvedFragment;
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

    _onStateChange = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const source = 'on_state_change';
      const { script, fragmentName } = resolvedFragment;
      const appName = state.app.name;
      const app = this._apps[appName];

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

    _onUpdateStatus = (statusDetails: StatusDetailsType, state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const source = 'on_update_status';
      const { script, fragmentName } = resolvedFragment;

      if (script.version === 3) {
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

    _updateStatus = async (resolvedFragments: Array<ResolvedFragmentType>, statusDetails: StatusDetailsType, state: StateType): Promise<void> => {
      await Promise.all(resolvedFragments.map(this._onUpdateStatus(statusDetails, state)));

      this._status = statusDetails.status;
      this.emit(this.constructor.eventTitles.STATUS_CHANGE, statusDetails);
    }

    _externalLink = (source: string) => {
      this.emit(this.constructor.eventTitles.EXTERNAL_LINK);

      const statusDetails = {
        level: this.constructor.levels.INFO,
        status: this.constructor.statuses.DEFAULT,
        source,
      };

      this._status = statusDetails.status;
      this.emit(this.constructor.eventTitles.STATUS_CHANGE, statusDetails);
    }

    _updatePage = async (eventTitle: string): Promise<void> => {
      const source = 'update_page';

      if (this._status === this.constructor.statuses.UNINITIALISED) {
        throw new AppManagerError('Tried to update path when before initialising.', {
          source,
          recoverable: true,
          code: 'app_not_ready',
        });
      }

      const newAppName = this._getAppNameFromPath();

      if (!newAppName) {
        this._externalLink(source);
        return;
      }

      const state = this._getState(newAppName, eventTitle);

      const newResolvedFragments = await this._resolveAppFragments(newAppName, state);

      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        throw new AppManagerError(`No old app set when trying to mount ${newAppName}`, {
          source,
          code: 'no_current_app',
          recoverable: true,
          id: newAppName,
        });
      }

      const newAppSlots = Object.keys(newResolvedFragments);

      if (!newAppSlots.every((slot) => newResolvedFragments[slot])) {
        this._externalLink(source);
        return;
      }

      const oldResolvedFragments = await this._resolveAppFragments(oldAppName, state);

      const oldAppSlots = Object.keys(oldResolvedFragments);

      const initialUnmount = oldAppSlots
        .filter((slotName) => newAppSlots.indexOf(slotName) === -1)
        .map((slotName) => oldResolvedFragments[slotName])
        .filter(Boolean);

      const initialRender = newAppSlots
        .filter((slotName) => oldAppSlots.indexOf(slotName) === -1)
        .map((slotName) => newResolvedFragments[slotName])
        .filter(Boolean);

      const fragmentDiff = newAppSlots
        .filter((slotName) => oldAppSlots.indexOf(slotName) > -1)
        .reduce((diff, slotName) => {
          const oldFragment = oldResolvedFragments[slotName];
          const newFragment = newResolvedFragments[slotName];

          const { unmount, render, onStateChange } = diff;

          if (!newFragment) {
            if (oldFragment) {
              unmount.push(oldFragment);
            }
          } else if (!oldFragment) {
            if (newFragment) {
              render.push(newFragment);
            }
          } else if (oldFragment.fragmentName === newFragment.fragmentName) {
            onStateChange.push(newFragment);
          } else {
            render.push(newFragment);
            unmount.push(oldFragment);
          }

          return { onStateChange, render, unmount };
        }, { unmount: initialUnmount, render: initialRender, onStateChange: [] });

      if (!fragmentDiff) {
        return;
      }

      const allFragments = [...fragmentDiff.unmount, ...fragmentDiff.render, ...fragmentDiff.onStateChange];

      try {
        const loadingStatusDetails = {
          level: this.constructor.levels.INFO,
          status: this.constructor.statuses.LOADING,
          source,
        };

        await this._updateStatus(allFragments, loadingStatusDetails, state);

        await Promise.all(fragmentDiff.unmount.map(this._unmount(state)));

        await Promise.all([
          ...fragmentDiff.render.map(this._render(state)),
          ...fragmentDiff.onStateChange.map(this._onStateChange(state)),
        ]);

        const defaultStatusDetails = {
          level: this.constructor.levels.INFO,
          status: this.constructor.statuses.DEFAULT,
          source,
        };

        await this._updateStatus(allFragments, defaultStatusDetails, state);

        this._currentAppName = newAppName;

        this.emit(this.constructor.eventTitles.STATE_CHANGE_COMPLETE);
      } catch (err) {
        const amError = new AppManagerError(err, {
          level: this.constructor.statuses.ERROR,
          source,
          path: this.constructor._getBrowserPath(),
        });

        const errorStatusDetails = {
          status: this.constructor.statuses.ERROR,
          level: amError.level || this.constructor.levels.ERROR,
          source: amError.source,
          message: amError.message,
        };

        await this._updateStatus(allFragments, errorStatusDetails, state);

        this.emit(this.constructor.eventTitles.ERROR, amError);
      }
    }

    _handleStateChange = async (eventTitle: mixed): Promise<void> => {
      try {
        const source = 'handle_state_change';

        if (typeof eventTitle !== 'string') {
          throw new AppManagerError(`Invalid eventTitle ${String(eventTitle)} emitted.`, {
            source,
            recoverable: true,
            code: 'invalid_event_title',
          });
        }

        await this._updatePage(eventTitle);
      } catch (err) {
        const amError = new AppManagerError(err, {
          level: this.constructor.statuses.ERROR,
          path: this.constructor._getBrowserPath(),
        });

        this.emit(this.constructor.eventTitles.ERROR, amError);
      }
    }

    _shimHistory() {
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

        this.removeListener(this.constructor.eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);

        w.onpopstate = onpopstate;
        w.history.pushState = pushState;
        w.history.replaceState = replaceState;
      };

      this.on(this.constructor.eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);
    }

    _setupPage = async (): Promise<void> => {
      const source = 'setup_page';

      const currentAppName = this._getAppNameFromPath();

      if (!currentAppName) {
        this._externalLink(source);
        return;
      }

      this._currentAppName = currentAppName;

      const state = this._getState(currentAppName);

      const resolvedFragments = await this._resolveAppFragments(state.app.name, state);

      const appSlots = Object.keys(resolvedFragments);

      if (!appSlots.every((slot) => resolvedFragments[slot])) {
        this._externalLink(source);
        return;
      }

      const appFragments = appSlots
        .map((slotName) => resolvedFragments[slotName])
        .filter(Boolean);

      try {
        const loadingStatusDetails = {
          level: this.constructor.levels.INFO,
          status: this.constructor.statuses.LOADING,
          source,
        };

        await this._updateStatus(appFragments, loadingStatusDetails, state);

        await Promise.all(appFragments.map(this._hydrate(state)));

        const defaultStatusDetails = {
          level: this.constructor.levels.INFO,
          status: this.constructor.statuses.DEFAULT,
          source,
        };

        await this._updateStatus(appFragments, defaultStatusDetails, state);
      } catch (err) {
        const amError = new AppManagerError(err, {
          level: this.constructor.levels.ERROR,
          source,
          path: this.constructor._getBrowserPath(),
        });

        const errorStatusDetails = {
          status: this.constructor.statuses.ERROR,
          level: amError.level || this.constructor.levels.ERROR,
          source: amError.source,
          message: amError.message,
        };

        await this._updateStatus(appFragments, errorStatusDetails, state);

        this.emit(this.constructor.eventTitles.ERROR, amError);
      }
    }

    init = async (): Promise<void> => {
      try {
        this._shimHistory();

        await this._setupPage();
      } catch (err) {
        const amError = new AppManagerError(err, {
          level: this.constructor.statuses.ERROR,
          path: this.constructor._getBrowserPath(),
        });

        this.emit(this.constructor.eventTitles.ERROR, amError);
      }
    }
  };
}
