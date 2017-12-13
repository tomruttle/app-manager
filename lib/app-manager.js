// @flow

import pathToRegexp from 'path-to-regexp';
import slotFinder from 'slot-finder';

import type {
  ScriptVersion3Type,
  ScriptVersion4Type,
  AppType,
  EventsType,
  ScriptType,
  OptionsType,
  ConfigType,
  AppNameType,
  FragmentNameType,
  SlotNameType,
  EventCallbackType,
  EventTitleType,
  StatusType,
} from './index';

import type Window from './utils/window-stub';

import { DEFAULT_TIMEOUT, statuses, eventTitles } from './constants';
import stateChangeShim from './utils/state-change-shim';

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

    static _timeout(timeout: number = DEFAULT_TIMEOUT): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    static _goToPath(): void {
      w.location.href = AppManager._getBrowserPath(); // eslint-disable-line no-param-reassign
    }

    static _getPathCheckers(apps: { [appName: AppNameType]: AppType }) {
      return Object.keys(apps || {}).reduce((appPathCheckers, appName) => {
        const { appPath } = apps[appName];

        if (!appPath || typeof appPath !== 'string') {
          return appPathCheckers;
        }

        return Object.assign({}, appPathCheckers, {
          [appName]: pathToRegexp(appPath),
        });
      }, {});
    }

    _apps: *;
    _slots: *;
    _fragments: *;
    _options: *;
    _events: *;
    _pathCheckers: *;

    constructor(config: ConfigType, events: EventsType, options: OptionsType = {}) {
      if (!config) {
        throw new Error('Config not specified. Aborting.');
      }

      if (!w.document || !w.location) {
        throw new Error('Invalid window object. Aborting.');
      }

      const { apps, slots, fragments } = config;

      this._apps = apps;
      this._slots = slots;
      this._fragments = fragments;
      this._events = events;
      this._options = options;
      this._pathCheckers = this.constructor._getPathCheckers(this._apps);
    }

    _status: $Values<typeof AppManager.statuses> = this.constructor.statuses.UNINITIALISED;

    _currentAppName: ?AppNameType = null;

    _resolvedFragments: { [fragmentName: FragmentNameType]: ResolvedFragmentType } = {};

    emit = (eventTitle: $Values<typeof AppManager.eventTitles>, data: mixed): void => {
      if (this._events && typeof this._events.emit === 'function') {
        this._events.emit(eventTitle, data);
      }
    }

    on = (eventTitle: $Values<typeof AppManager.eventTitles>, listener: EventCallbackType): void => {
      if (this._events && typeof this._events.on === 'function') {
        this._events.on(eventTitle, listener);
      }
    }

    removeListener = (eventTitle: $Values<typeof AppManager.eventTitles>, listener: EventCallbackType): void => {
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

    _getAppFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      if (!path || typeof path !== 'string') {
        this._onError('get_app_from_path.no_path');

        return null;
      }

      return Object.keys(this._pathCheckers).find((appName) => {
        const pathChecker = this._pathCheckers[appName];

        if (!pathChecker) {
          this._onError('get_app_from_path.invalid_appPath', appName);

          return false;
        }

        return pathChecker.exec(path);
      });
    }

    _getSlotElement = (slotName: SlotNameType): ?Element => {
      const slot = this._slots[slotName];

      if (!slot) {
        this._onError('get_slot_element.no_slot', slotName);

        return null;
      }

      const element = w.document.querySelector(`.${slot.elementClass}`);

      if (!element) {
        this._onError('get_slot_element.no_element', slotName);

        return null;
      }

      return element;
    }

    _loadFragmentScript = async (fragmentName: FragmentNameType): Promise<?ScriptType> => {
      const fragment = this._fragments[fragmentName];

      if (!fragment) {
        this._onError('load_fragment_script.invalid_fragment', fragmentName);

        return null;
      }

      if (typeof fragment.load !== 'function') {
        this._onError('load_fragment_script.not_function', fragmentName);

        return null;
      }

      try {
        const script = await Promise.race([
          fragment.load(),
          this.constructor._timeout(this._options.importTimeout),
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

    _resolveFragment = async (slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?ResolvedFragmentType> => {
      if (this._resolvedFragments[fragmentName]) {
        return this._resolvedFragments[fragmentName];
      }

      const script = await this._loadFragmentScript(fragmentName);

      if (!script) {
        return null;
      }

      const resolvedFragment = { script, slot: slotName, name: fragmentName };

      this._resolvedFragments[fragmentName] = resolvedFragment;

      return resolvedFragment;
    }

    _resolvePageFragments = async (appName: AppNameType): Promise<?Array<?ResolvedFragmentType>> => {
      const app = this._apps[appName];

      if (!Array.isArray(app.fragments)) {
        this._onError('resolve_page_fragments.invalid_app', appName);

        return null;
      }

      const appFragments = app.fragments
        .map((fragmentName) => this._fragments[fragmentName])
        .filter((fragment) => fragment.managed)
        .map(({ name, slots }) => ({ name, slots }));

      const emptySlots = Object.keys(this._slots)
        .reduce((empty, slotName) => Object.assign(empty, { [slotName]: null }), {});

      const pageFragments = slotFinder(emptySlots, appFragments);

      if (!pageFragments || typeof pageFragments !== 'object') {
        this._onError('resolve_page_fragments.get', appName);

        return null;
      }

      const resolveFragmentPromises = Object.keys(pageFragments)
        .filter((slotName) => pageFragments[slotName])
        .map((slotName) => this._resolveFragment(slotName, pageFragments[slotName]));

      return Promise.all(resolveFragmentPromises);
    }

    _hydrate = (appName: AppNameType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name, slot } = resolvedFragment;

      try {
        const slotElement = this._getSlotElement(slot);

        if (!slotElement) {
          this._onError('hydrate.missing_element', slot);

          return false;
        }

        if (typeof script.hydrate !== 'function') {
          this._onError('hydrate.invalid_script', name || appName);

          return false;
        }

        const app = this._apps[appName];

        if (script.version === 3) {
          await (script: ScriptVersion3Type).hydrate(slotElement, w.history, app);
        } else {
          await (script: ScriptVersion4Type).hydrate(slotElement, app);
        }

        return true;
      } catch (err) {
        this._onError('hydrate.run_script', name, err);

        return false;
      }
    }

    _unmount = (appName: AppNameType, eventTitle: EventTitleType) => async (resolvedFragment: ResolvedFragmentType): Promise<?boolean> => {
      const { script, name, slot } = resolvedFragment;

      try {
        const slotElement = this._getSlotElement(slot);

        if (!slotElement) {
          this._onError('unmount.missing', slot);

          return false;
        }

        if (typeof script.unmount !== 'function') {
          this._onError('unmount.invalid_script', name || appName);

          return false;
        }

        const app = this._apps[appName];

        if (script.version === 3) {
          await (script: ScriptVersion3Type).unmount(slotElement, w.history, app);
        } else {
          await (script: ScriptVersion4Type).unmount(slotElement, eventTitle, app);
        }

        return true;
      } catch (err) {
        this._onError('unmount.error', name || appName, err);

        return false;
      }
    }

    _mount = (appName: AppNameType, eventTitle: EventTitleType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name, slot } = resolvedFragment;

      try {
        const slotElement = this._getSlotElement(slot);

        if (!slotElement) {
          this._onError('mount.missing', name || appName);

          return false;
        }

        if (typeof script.mount !== 'function') {
          this._onError('mount.invalid_script', name || appName);

          return false;
        }

        const app = this._apps[appName];

        if (script.version === 3) {
          await (script: ScriptVersion3Type).mount(slotElement, w.history, app);
        } else {
          await (script: ScriptVersion4Type).mount(slotElement, eventTitle, app);
        }

        return true;
      } catch (err) {
        this._onError('mount.error', name || appName, err);

        return false;
      }
    }

    _onStateChange = (appName: AppNameType, eventTitle: EventTitleType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      const { script, name } = resolvedFragment;

      try {
        if (typeof script.onStateChange !== 'function') {
          this._onError('on_state_change.invalid_script', name || appName);

          return false;
        }

        const app = this._apps[appName];

        if (script.version === 3) {
          await (script: ScriptVersion3Type).onStateChange(w.history, app);
        } else {
          await (script: ScriptVersion4Type).onStateChange(eventTitle, app);
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
        if (typeof script.onUpdateStatus !== 'function') {
          this._onError('on_update_status.invalid_script', name || appName);

          return false;
        }

        const app = this._apps[appName];

        await script.onUpdateStatus(status, app);

        return true;
      } catch (err) {
        this._onError('on_update_status.error', name || appName, err);

        return false;
      }
    }

    _hydratePage = async (): Promise<boolean> => {
      const currentAppName = this._currentAppName;

      if (!currentAppName) {
        this._onError('hydrate_page.missing_route');

        return false;
      }

      try {
        const resolvedFragments = await this._resolvePageFragments(currentAppName);

        if (!Array.isArray(resolvedFragments) || !resolvedFragments.every(Boolean)) {
          return false;
        }

        const hydratePromises = resolvedFragments.map(this._hydrate(currentAppName));

        const hydrateSuccess = await Promise.all(hydratePromises);

        return hydrateSuccess.every(Boolean);
      } catch (err) {
        this._onError('hydrate_page.get_scripts', currentAppName, err);

        return false;
      }
    }

    _updatePage = async (newAppName: AppNameType, eventTitle: EventTitleType): Promise<boolean> => {
      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        this._onError('update_page.no_current_app');

        return false;
      }

      const [oldResolvedFragments, newResolvedFragments] = await Promise.all([
        this._resolvePageFragments(oldAppName),
        this._resolvePageFragments(newAppName),
      ]);

      if (!Array.isArray(oldResolvedFragments) || !Array.isArray(newResolvedFragments) || !oldResolvedFragments.every(Boolean) || !newResolvedFragments.every(Boolean)) {
        this._onError('update_page.invalid_fragments');

        return false;
      }

      const oldFragmentNames = oldResolvedFragments.map(({ name }) => name);
      const newFragmentNames = newResolvedFragments.map(({ name }) => name);

      const unmountPromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._unmount(oldAppName, eventTitle));

      const mountPromises = newResolvedFragments
        .filter((resolvedFragment) => oldFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._mount(newAppName, eventTitle));

      const onStateChangePromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) > -1)
        .map(this._onStateChange(newAppName, eventTitle));

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
      if (this._status !== this.constructor.statuses.DEFAULT) {
        this.constructor._goToPath();

        return false;
      }

      if (typeof eventTitle !== 'string') {
        this._onError('handle_state_change.invalid_event_title');

        return false;
      }

      this._setStatus(this.constructor.statuses.LOADING);

      const newAppName = this._getAppFromPath();

      if (!newAppName) {
        this._onError('handle_state_change.app_not_found');
        this.constructor._goToPath();

        return false;
      }

      try {
        const updatePageSuccess = await this._updatePage(newAppName, eventTitle);

        if (!updatePageSuccess) {
          this._setStatus(this.constructor.statuses.ERROR);
          this.constructor._goToPath();

          return false;
        }

        this._currentAppName = newAppName;
        this._setStatus(this.constructor.statuses.DEFAULT);

        return true;
      } catch (err) {
        this._onError('handle_state_change', newAppName, err);
        this.constructor._goToPath();

        return false;
      }
    }

    _handleUpdateStatus = async (status: mixed): Promise<boolean> => {
      const currentAppName = this._currentAppName;

      if (!currentAppName) {
        return false;
      }

      if (typeof status !== 'string') {
        return false;
      }

      try {
        const resolvedFragments = await this._resolvePageFragments(currentAppName);

        if (!Array.isArray(resolvedFragments) || !resolvedFragments.every(Boolean)) {
          return false;
        }

        const updateStatusPromises = resolvedFragments.map(this._onUpdateStatus(currentAppName, status));

        const updateStatusSuccess = await Promise.all(updateStatusPromises);

        return updateStatusSuccess.every(Boolean);
      } catch (err) {
        this._onError('handle_update_status', currentAppName, err);

        return false;
      }
    }

    init = async (): Promise<boolean> => {
      stateChangeShim(w, this.emit);

      this.on(this.constructor.eventTitles.HISTORY_STATE_CHANGE, this._handleStateChange);
      this.on(this.constructor.eventTitles.STATUS_CHANGE, this._handleUpdateStatus);

      this._setStatus(this.constructor.statuses.LOADING);

      if (!Object.keys(this._slots).every((slotName) => this._getSlotElement(slotName))) {
        this._onError('init.missing_elements');

        return false;
      }

      const currentAppName = this._getAppFromPath();

      if (!currentAppName) {
        this._onError('init.no_route');

        return false;
      }

      this._currentAppName = currentAppName;

      const hydrateSuccess = await this._hydratePage();

      if (!hydrateSuccess) {
        this._setStatus(this.constructor.statuses.ERROR);

        return false;
      }

      this._setStatus(this.constructor.statuses.DEFAULT);

      return true;
    }
  };
}
