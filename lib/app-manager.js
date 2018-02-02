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
  StatusType,
  EmitterType,
  RemoveListenerType,
  SubscriberType,
  SlotType,
  StateType,
  ParamsType,
  QueryType,
} from './index';

import type Window from './utils/window-stub';

import { DOM_CHECK_INTERVAL, statuses, eventTitles } from './constants';

type ResolvedFragmentType = {
  script: ScriptType,
  slot: SlotNameType,
  name: FragmentNameType,
};

export default function initAppManager(w: Window) {
  return class AppManager {
    static statuses = statuses;
    static eventTitles = eventTitles;

    static _getBrowserPath(): string {
      const path = w.location.pathname;

      if (!path || typeof path !== 'string') {
        throw new AppManagerError('Could not get path from browser.', {
          source: 'get_browser_path',
          type: 'no_path',
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

    static _goToPath(): void {
      w.location.href = AppManager._getBrowserPath(); // eslint-disable-line no-param-reassign
    }

    _apps: *;
    _slots: *;
    _fragments: *;
    _options: *;
    _events: *;
    _evaluatedPaths: *;

    constructor(config: ConfigType, events: EventsType, options: OptionsType = {}) {
      if (!config) {
        throw new AppManagerError('Config not specified. Aborting.', {
          source: 'constructor',
          type: 'invalid_config',
        });
      }

      if (!w.document || !w.location || !w.history) {
        throw new AppManagerError('Invalid window object. Aborting.', {
          source: 'constructor',
          type: 'invalid_environment',
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

    _resolvedFragments: { [fragmentName: FragmentNameType]: ResolvedFragmentType } = {};

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

    _setStatus = (newStatus: $Values<typeof AppManager.statuses>): void => {
      if (this._status !== newStatus) {
        this._status = newStatus;
        this.emit(this.constructor.eventTitles.STATUS_CHANGE, newStatus);
      }
    }

    _onError = (err: AppManagerError): void => {
      this._setStatus(this.constructor.statuses.ERROR);
      this.emit(this.constructor.eventTitles.ERROR, err);
    }

    _getAppNameFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      return getAppNameFromPath(this._evaluatedPaths, path);
    }

    _getPathParams = (appName: AppNameType): ParamsType => {
      const path = this.constructor._getBrowserPath();

      const evaluatedPath = this._evaluatedPaths[appName];

      const params = evalPathParams(evaluatedPath, path);

      if (!params) {
        throw new AppManagerError('Browser path does not match current app.', {
          source: 'get_path_params',
          type: 'invalid_path',
        });
      }

      return params;
    }

    _getSlotElement = async (slot: SlotType): Promise<?Element> => {
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
          source: 'get_slot_element',
          type: 'element_not_found',
          id: slot.name,
        });
      }

      return element;
    }

    _loadFragmentScript = async (fragmentName: FragmentNameType, state: StateType): Promise<ScriptType> => {
      const fragment = this._fragments[fragmentName];

      if (!fragment) {
        throw new AppManagerError(`Tried to load invalid fragment ${fragmentName}.`, {
          source: 'load_fragment_script',
          type: 'fragment_not_found',
          id: fragmentName,
        });
      }

      if (typeof fragment.loadScript !== 'function') {
        throw new AppManagerError(`Fragment ${fragmentName} does not have a loadScript function.`, {
          source: 'load_fragment_script',
          type: 'invalid_fragment',
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
          source: 'load_fragment_script',
          type: 'load_script',
          id: fragmentName,
        });
      }

      if (!script) {
        throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, {
          source: 'load_fragment_script',
          type: 'time_out',
          id: fragmentName,
        });
      }

      if (!('version' in script)) {
        throw new AppManagerError(`Loaded script for fragment ${fragmentName} does not have a version property.`, {
          source: 'load_fragment_script',
          type: 'invalid_script',
          id: fragmentName,
        });
      }

      return script;
    }

    _resolveFragment = async (slotName: SlotNameType, fragmentName: FragmentNameType, state: StateType): Promise<ResolvedFragmentType> => {
      if (this._resolvedFragments[fragmentName]) {
        return this._resolvedFragments[fragmentName];
      }

      const script = await this._loadFragmentScript(fragmentName, state);

      const resolvedFragment = { script, slot: slotName, name: fragmentName };

      this._resolvedFragments[fragmentName] = resolvedFragment;

      return resolvedFragment;
    }

    _findPageFragments = (appName: AppNameType): { [slotName: SlotNameType]: string } => {
      const app = this._apps[appName];

      if (!Array.isArray(app.fragments)) {
        throw new AppManagerError(`App ${appName} does not have a fragments array`, {
          source: 'find_page_fragments',
          type: 'invalid_app',
          id: appName,
        });
      }

      const appFragments = app.fragments
        .map((fragmentName) => this._fragments[fragmentName]);

      const emptySlots = Object.keys(this._slots)
        .reduce((empty, slotName) => Object.assign(empty, { [slotName]: null }), {});

      let pageFragments;

      try {
        pageFragments = slotFinder(emptySlots, appFragments);
      } catch (err) {
        throw new AppManagerError(err, {
          source: 'find_page_fragments',
          type: 'slot_finder',
          id: appName,
        });
      }


      if (!pageFragments || typeof pageFragments !== 'object') {
        throw new AppManagerError(`SlotFinder returned invalid fragments for app ${appName}`, {
          source: 'find_page_fragments',
          type: 'get_fragments',
          id: appName,
        });
      }

      return pageFragments;
    }

    _resolvePageFragments = async (pageFragments: { [slotName: SlotNameType]: string }, state: StateType): Promise<Array<ResolvedFragmentType>> => {
      const resolveFragmentPromises = Object.keys(pageFragments)
        .filter((slotName) => {
          const fragmentName = pageFragments[slotName];
          return fragmentName && this._fragments[fragmentName].managed;
        })
        .map((slotName) => this._resolveFragment(slotName, pageFragments[slotName], state));

      return Promise.all(resolveFragmentPromises);
    };

    _getState = (appName: AppNameType, eventTitle: ?EventTitleType = null): StateType => ({
      status: this._status,
      event: eventTitle,
      path: this.constructor._getBrowserPath(),
      params: this._getPathParams(appName),
      query: this.constructor._getQuery(),
      prevApp: this._currentAppName ? this._apps[this._currentAppName] : null,
      app: this._apps[appName],
    });

    _hydrate = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<?void> => {
      const { script, name, slot: slotName } = resolvedFragment;
      const appName = state.app.name;
      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${name} tried to mount into non-existent slot ${slot}`, {
          source: 'hydrate',
          type: 'invalid_slot',
          id: name,
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
          source: 'hydrate',
          type: 'render',
          id: name,
        });
      }
    }

    _unmount = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<?void> => {
      const { script, name, slot: slotName } = resolvedFragment;

      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${name} tried to unmount from non-existent slot ${slot}`, {
          source: 'unmount',
          type: 'invalid_slot',
          id: name,
        });
      }

      const slotElement = await this._getSlotElement(slot);

      if (!slotElement) {
        return;
      }

      const oldAppName = state.prevApp ? state.prevApp.name : null;
      const oldApp = oldAppName ? this._apps[oldAppName] : null;

      if (!oldApp || !state.event) {
        throw new AppManagerError(`Invalid state passed to unmount function for fragment ${name}`, {
          source: 'unmount',
          type: 'invalid_state',
          id: name,
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
          source: 'unmount',
          type: 'unmount',
          id: name,
        });
      }
    }

    _mount = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const { script, name, slot: slotName } = resolvedFragment;
      const appName = state.app.name;

      const slot = this._slots[slotName];

      if (!slot) {
        throw new AppManagerError(`Fragment ${name} tried to mount into non-existent slot ${slot}`, {
          source: 'mount',
          type: 'invalid_slot',
          id: name,
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
            throw new AppManagerError(`Invalid state passed to unmount function for fragment ${name}`, {
              source: 'mount',
              type: 'invalid_state',
              id: name,
            });
          }

          await (script: ScriptVersion4Type).mount(slotElement, state.event, app);
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source: 'mount',
          type: 'render',
          id: name,
        });
      }
    }

    _onStateChange = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const { script, name } = resolvedFragment;
      const appName = state.app.name;
      const app = this._apps[appName];

      try {
        if (script.version === 3) {
          await script.onStateChange(w.history, app);
        } else if (script.version === 4) {
          if (typeof script.onStateChange === 'function') {
            if (!state.event) {
              throw new AppManagerError(`Invalid state passed to unmount function for fragment ${name}`, {
                source: 'mount',
                type: 'invalid_state',
                id: name,
              });
            }

            await script.onStateChange(state.event, app);
          }
        } else if (typeof script.onStateChange === 'function') {
          await script.onStateChange(state);
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source: 'on_state_change',
          type: 'on_state_change',
          id: name,
        });
      }
    }

    _onUpdateStatus = (appName: AppNameType, status: StatusType) => async (resolvedFragment: ResolvedFragmentType): Promise<void> => {
      const { script, name } = resolvedFragment;

      if (script.version === 3) {
        return;
      }

      const app = this._apps[appName];

      try {
        if (script.version === 4) {
          if (typeof script.onUpdateStatus === 'function') {
            await script.onUpdateStatus(status, app);
          }
        } else if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus({ status });
        }
      } catch (err) {
        throw new AppManagerError(err, {
          source: 'on_update_status',
          type: 'on_update_status',
          id: name,
        });
      }
    }

    _hydratePage = async (state: StateType): Promise<void> => {
      const pageFragments = this._findPageFragments(state.app.name);

      const resolvedFragments = await this._resolvePageFragments(pageFragments, state);

      const hydratePromises = resolvedFragments.map(this._hydrate(state));

      await Promise.all(hydratePromises);
    }

    _updatePage = async (state: StateType): Promise<void> => {
      const oldAppName = this._currentAppName;
      const newAppName = state.app.name;

      if (!oldAppName) {
        throw new AppManagerError(`No old app set when trying to mount ${newAppName}`, {
          source: 'update_page',
          type: 'no_current_app',
          id: newAppName,
        });
      }

      const oldPageFragments = this._findPageFragments(oldAppName);
      const newPageFragments = this._findPageFragments(newAppName);

      const [oldResolvedFragments, newResolvedFragments] = await Promise.all([
        this._resolvePageFragments(oldPageFragments, state),
        this._resolvePageFragments(newPageFragments, state),
      ]);

      const oldFragmentNames = oldResolvedFragments.map(({ name }) => name);
      const newFragmentNames = newResolvedFragments.map(({ name }) => name);

      const unmountPromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._unmount(state));

      await Promise.all(unmountPromises);

      const mountPromises = newResolvedFragments
        .filter((resolvedFragment) => oldFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._mount(state));

      await Promise.all(mountPromises);

      const onStateChangePromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) > -1)
        .map(this._onStateChange(state));

      await Promise.all(onStateChangePromises);
    }

    _handleStateChange = async (eventTitle: mixed): Promise<void> => {
      try {
        if (typeof eventTitle !== 'string') {
          throw new AppManagerError(`Invalid eventTitle ${String(eventTitle)} emitted.`, {
            source: 'handle_state_change',
            type: 'invalid_event_title',
          });
        }

        if (this._status === this.constructor.statuses.UNINITIALISED) {
          throw new AppManagerError('Tried to update path when before initialising.', {
            source: 'handle_state_change',
            type: 'app_not_ready',
          });
        }

        this._setStatus(this.constructor.statuses.LOADING);

        const newAppName = this._getAppNameFromPath();

        if (!newAppName) {
          /* WHAT TO DO HERE? */
          this.constructor._goToPath();
          return;
        }

        const state = this._getState(newAppName, eventTitle);

        await this._updatePage(state);

        this._currentAppName = newAppName;
        this._setStatus(this.constructor.statuses.DEFAULT);
        this.emit(this.constructor.eventTitles.STATE_CHANGE_COMPLETE);
      } catch (err) {
        this._onError(new AppManagerError(err, {
          source: 'handle_state_change',
          path: this.constructor._getBrowserPath(),
        }));
      }
    }

    // _handleUpdateStatus = async (status: mixed): Promise<boolean> => {
    //   const currentAppName = this._currentAppName;
    //
    //   if (!currentAppName) {
    //     return false;
    //   }
    //
    //   if (typeof status !== 'string') {
    //     return false;
    //   }
    //
    //   try {
    //     const resolvedFragments = await this._resolvePageFragments(currentAppName);
    //
    //     if (!Array.isArray(resolvedFragments) || !resolvedFragments.every(Boolean)) {
    //       return false;
    //     }
    //
    //     const updateStatusPromises = resolvedFragments.map(this._onUpdateStatus(currentAppName, status));
    //
    //     const updateStatusSuccess = await Promise.all(updateStatusPromises);
    //
    //     return updateStatusSuccess.every(Boolean);
    //   } catch (err) {
    //     this._onError('handle_update_status', currentAppName, err);
    //
    //     return false;
    //   }
    // }

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
        // this.removeListener(this.constructor.eventTitles.STATUS_CHANGE, this._handleUpdateStatus);

        w.onpopstate = onpopstate;
        w.history.pushState = pushState;
        w.history.replaceState = replaceState;
      };

      this.on(this.constructor.eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);
      // this.on(this.constructor.eventTitles.STATUS_CHANGE, this._handleUpdateStatus);
    }

    init = async (): Promise<void> => {
      try {
        this._shimHistory();

        this._setStatus(this.constructor.statuses.LOADING);

        const currentAppName = this._getAppNameFromPath();

        if (!currentAppName) {
          /* WHAT TO DO HERE? */
          this.constructor._goToPath();
          return;
        }

        this._currentAppName = currentAppName;

        const state = this._getState(currentAppName);

        await this._hydratePage(state);

        this._setStatus(this.constructor.statuses.DEFAULT);
      } catch (err) {
        this._onError(new AppManagerError(err, {
          source: 'init',
          path: this.constructor._getBrowserPath(),
        }));
      }
    }
  };
}
