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
      return w.location.pathname;
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
          type: 'invalid.config',
        });
      }

      if (!w.document || !w.location || !w.history) {
        throw new AppManagerError('Invalid window object. Aborting.', {
          source: 'constructor',
          type: 'invalid.environment',
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

    _onError = (title: string, id?: ?string, err?: Error): void => {
      this._setStatus(this.constructor.statuses.ERROR);
      this.emit(this.constructor.eventTitles.ERROR, { title, id, err });
    }

    _getAppNameFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      if (!path || typeof path !== 'string') {
        this._onError('get_app_from_path.no_path');

        return null;
      }

      return getAppNameFromPath(this._evaluatedPaths, path);
    }

    _getPathParams = (appName: AppNameType): ParamsType => {
      const path = this.constructor._getBrowserPath();

      if (!path || typeof path !== 'string') {
        this._onError('get_path_params.no_path');

        return {};
      }

      const evaluatedPath = this._evaluatedPaths[appName];

      const params = evalPathParams(evaluatedPath, path);

      if (!params) {
        this._onError('get_path_params.invalid_appPath');

        return {};
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
          source: 'constructor',
          type: 'invalid.config',
          id: slot.name,
        });
      }

      return element;
    }

    _loadFragmentScript = async (fragmentName: FragmentNameType, state: StateType): Promise<?ScriptType> => {
      const fragment = this._fragments[fragmentName];

      if (!fragment) {
        this._onError('load_fragment_script.invalid_fragment', fragmentName);

        return null;
      }

      if (typeof fragment.loadScript !== 'function') {
        this._onError('load_fragment_script.not_function', fragmentName);

        return null;
      }

      try {
        const script = await Promise.race([
          fragment.loadScript(state),
          delay(this._options.importTimeout),
        ]);

        if (!script) {
          this._onError('load_fragment_script.no_script', fragmentName);

          return null;
        }

        if (!('version' in script)) {
          this._onError('load_fragment_script.invalid_script', fragmentName);

          return null;
        }

        return script;
      } catch (err) {
        this._onError('load_fragment_script.load', fragmentName, err);

        return null;
      }
    }

    _resolveFragment = async (slotName: SlotNameType, fragmentName: FragmentNameType, state: StateType): Promise<?ResolvedFragmentType> => {
      if (this._resolvedFragments[fragmentName]) {
        return this._resolvedFragments[fragmentName];
      }

      const script = await this._loadFragmentScript(fragmentName, state);

      if (!script) {
        return null;
      }

      const resolvedFragment = { script, slot: slotName, name: fragmentName };

      this._resolvedFragments[fragmentName] = resolvedFragment;

      return resolvedFragment;
    }

    _findPageFragments = (appName: AppNameType): ?{ [slotName: SlotNameType]: string } => {
      const app = this._apps[appName];

      if (!Array.isArray(app.fragments)) {
        this._onError('resolve_page_fragments.invalid_app', appName);

        return null;
      }

      const appFragments = app.fragments
        .map((fragmentName) => this._fragments[fragmentName]);

      const emptySlots = Object.keys(this._slots)
        .reduce((empty, slotName) => Object.assign(empty, { [slotName]: null }), {});

      const pageFragments = slotFinder(emptySlots, appFragments);

      if (!pageFragments || typeof pageFragments !== 'object') {
        this._onError('resolve_page_fragments.get', appName);

        return null;
      }

      return pageFragments;
    }

    _resolvePageFragments = async (pageFragments: { [slotName: SlotNameType]: string }, state: StateType): Promise<?Array<?ResolvedFragmentType>> => {
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

    _hydrate = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name, slot: slotName } = resolvedFragment;
      const appName = state.app.name;
      const slot = this._slots[slotName];

      if (!slot) {
        this._onError('hydrate.no_slot', slotName);

        return false;
      }

      let slotElement;

      try {
        slotElement = await this._getSlotElement(slot);
      } catch (err) {
        this._onError('hydrate.no_element', slot.name);

        return false;
      }

      if (!slotElement) {
        return true;
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

        return true;
      } catch (err) {
        this._onError('hydrate.run_script', name, err);

        return false;
      }
    }

    _unmount = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<?boolean> => {
      const { script, name, slot: slotName } = resolvedFragment;

      let oldAppName;

      try {
        const slot = this._slots[slotName];

        if (!slot) {
          this._onError('unmount.no_slot', slotName);

          return false;
        }

        let slotElement;

        try {
          slotElement = await this._getSlotElement(slot);
        } catch (err) {
          this._onError('unmount.no_element', slot.name);

          return false;
        }

        if (!slotElement) {
          return true;
        }

        oldAppName = state.prevApp ? state.prevApp.name : null;
        const app = oldAppName ? this._apps[oldAppName] : null;

        if (!app || !state.event) {
          this._onError('invalid_state');

          return null;
        }

        if (script.version === 3) {
          await script.unmount(slotElement, w.history, app);
        } else if (script.version === 4) {
          await script.unmount(slotElement, state.event, app);
        } else if (typeof script.unmount === 'function') {
          await script.unmount(slotElement, state);
        }

        return true;
      } catch (err) {
        this._onError('unmount.error', name || oldAppName, err);

        return false;
      }
    }

    _mount = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name, slot: slotName } = resolvedFragment;
      const appName = state.app.name;

      try {
        const slot = this._slots[slotName];

        if (!slot) {
          this._onError('mount.no_slot', slotName);

          return false;
        }

        let slotElement;

        try {
          slotElement = await this._getSlotElement(slot);
        } catch (err) {
          this._onError('mount.no_element', slot.name);

          return false;
        }

        if (!slotElement) {
          return true;
        }

        const app = this._apps[appName];

        if (script.version === 3) {
          await (script: ScriptVersion3Type).mount(slotElement, w.history, app);
        } else if (script.version === 4) {
          if (!state.event) {
            this._onError('no_event');
            return false;
          }

          await (script: ScriptVersion4Type).mount(slotElement, state.event, app);
        } else if (typeof script.render === 'function') {
          await script.render(slotElement, state);
        }

        return true;
      } catch (err) {
        this._onError('mount.error', name || appName, err);

        return false;
      }
    }

    _onStateChange = (state: StateType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name } = resolvedFragment;
      const appName = state.app.name;

      try {
        const app = this._apps[appName];

        if (script.version === 3) {
          await script.onStateChange(w.history, app);
        } else if (script.version === 4) {
          if (typeof script.onStateChange === 'function') {
            if (!state.event) {
              this._onError('no_event');
              return false;
            }

            await script.onStateChange(state.event, app);
          }
        } else if (typeof script.onStateChange === 'function') {
          await script.onStateChange(state);
        }

        return true;
      } catch (err) {
        this._onError('on_state_change.error', name || appName, err);

        return false;
      }
    }

    _onUpdateStatus = (appName: AppNameType, status: StatusType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name } = resolvedFragment;

      if (script.version === 3) {
        return true;
      }

      try {
        const app = this._apps[appName];

        if (script.version === 4) {
          if (typeof script.onUpdateStatus === 'function') {
            await script.onUpdateStatus(status, app);
          }
        } else if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus({ status });
        }

        return true;
      } catch (err) {
        this._onError('on_update_status.error', name || appName, err);

        return false;
      }
    }

    _hydratePage = async (state: StateType): Promise<boolean> => {
      try {
        const pageFragments = this._findPageFragments(state.app.name);

        if (!pageFragments) {
          return false;
        }

        const resolvedFragments = await this._resolvePageFragments(pageFragments, state);

        if (!Array.isArray(resolvedFragments) || !resolvedFragments.every(Boolean)) {
          return false;
        }

        const hydratePromises = resolvedFragments.map(this._hydrate(state));

        const hydrateSuccess = await Promise.all(hydratePromises);

        return hydrateSuccess.every(Boolean);
      } catch (err) {
        this._onError('hydrate_page.get_scripts', state.app.name, err);

        return false;
      }
    }

    _updatePage = async (state: StateType): Promise<boolean> => {
      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        this._onError('update_page.no_current_app');

        return false;
      }

      const oldPageFragments = this._findPageFragments(oldAppName);
      const newPageFragments = this._findPageFragments(state.app.name);

      if (!oldPageFragments || !newPageFragments) {
        return false;
      }

      const [oldResolvedFragments, newResolvedFragments] = await Promise.all([
        this._resolvePageFragments(oldPageFragments, state),
        this._resolvePageFragments(newPageFragments, state),
      ]);

      if (!Array.isArray(oldResolvedFragments) || !Array.isArray(newResolvedFragments) || !oldResolvedFragments.every(Boolean) || !newResolvedFragments.every(Boolean)) {
        this._onError('update_page.invalid_fragments');

        return false;
      }

      const oldFragmentNames = oldResolvedFragments.map(({ name }) => name);
      const newFragmentNames = newResolvedFragments.map(({ name }) => name);

      const unmountPromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._unmount(state));

      const mountPromises = newResolvedFragments
        .filter((resolvedFragment) => oldFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._mount(state));

      const onStateChangePromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) > -1)
        .map(this._onStateChange(state));

      const unmountSuccess = await Promise.all(unmountPromises);

      if (!unmountSuccess.every(Boolean)) {
        return false;
      }

      const mountSuccess = await Promise.all(mountPromises);

      if (!mountSuccess.every(Boolean)) {
        return false;
      }

      const onStateChangeSuccess = await Promise.all(onStateChangePromises);

      return onStateChangeSuccess.every(Boolean);
    }

    _handleStateChange = async (eventTitle: mixed): Promise<boolean> => {
      if (this._status === this.constructor.statuses.ERROR) {
        this.constructor._goToPath();

        return false;
      }

      if (this._status === this.constructor.statuses.UNINITIALISED) {
        this._onError('handle_state_change.app_not_ready');

        return false;
      }

      if (typeof eventTitle !== 'string') {
        this._onError('handle_state_change.invalid_event_title');

        return false;
      }

      this._setStatus(this.constructor.statuses.LOADING);

      const newAppName = this._getAppNameFromPath();

      if (!newAppName) {
        this._onError('handle_state_change.app_not_found');
        this.constructor._goToPath();

        return false;
      }

      try {
        const state = this._getState(newAppName, eventTitle);

        const updatePageSuccess = await this._updatePage(state);

        if (!updatePageSuccess) {
          this._setStatus(this.constructor.statuses.ERROR);
          this.constructor._goToPath();

          return false;
        }

        this._currentAppName = newAppName;
        this._setStatus(this.constructor.statuses.DEFAULT);
        this.emit(this.constructor.eventTitles.STATE_CHANGE_COMPLETE);

        return true;
      } catch (err) {
        this._onError('handle_state_change', newAppName, err);
        this.constructor._goToPath();

        return false;
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

    init = async (): Promise<boolean> => {
      this._shimHistory();

      this._setStatus(this.constructor.statuses.LOADING);

      const currentAppName = this._getAppNameFromPath();

      if (!currentAppName) {
        this._onError('init.no_route');

        return false;
      }

      this._currentAppName = currentAppName;

      const state = this._getState(currentAppName);

      const hydrateSuccess = await this._hydratePage(state);

      if (!hydrateSuccess) {
        this._setStatus(this.constructor.statuses.ERROR);

        return false;
      }

      this._setStatus(this.constructor.statuses.DEFAULT);

      return true;
    }
  };
}
