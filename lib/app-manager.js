// @flow

import pathToRegexp from 'path-to-regexp';
import slotFinder from 'slot-finder';

import type History from 'html5-history';

import type {
  HistoryType,
  ScriptType,
  OptionsType,
  ConfigType,
  AppNameType,
  FragmentNameType,
  SlotNameType,
} from './index';

import { statuses, events, DEFAULT_TIMEOUT } from './constants';
import decorateHistory from './utils/decorate-history';

type WindowType = any;

type ResolvedFragmentType = {
  script: ScriptType,
  slot: SlotNameType,
  name: FragmentNameType,
};

export default function initAppManager(w: WindowType, html5History: History) {
  const history: HistoryType = decorateHistory(w, html5History);

  return class AppManager {
    static statuses = statuses

    static events = events

    static _getBrowserPath(): string {
      const browserState = history.getState();
      return (browserState.hash || '').split('?')[0];
    }

    static _timeout(timeout: number = DEFAULT_TIMEOUT): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    static triggerEvent(event: $Values<typeof AppManager.events>, data: mixed): void {
      history.events.trigger(event, data);
    }

    static bindEvent(event: $Values<typeof AppManager.events>, callback: (data: mixed) => mixed): void {
      history.events.bind(event, callback);
    }

    static unbindEvent(event: $Values<typeof AppManager.events>): void {
      history.events.unbind(event);
    }

    static _triggerError(title: string, id?: ?string, err?: Error): void {
      AppManager.triggerEvent(AppManager.events.ERROR, { title, id, err });
    }

    static _goToPath(): void {
      w.location.href = AppManager._getBrowserPath(); // eslint-disable-line no-param-reassign
    }

    _apps: *;
    _slots: *;
    _fragments: *;
    _pathCheckers: *;
    _options: *;
    _status: $Values<typeof AppManager.statuses>;
    _initialised: boolean;
    _currentAppName: ?AppNameType;
    _resolvedFragments: { [fragmentName: FragmentNameType]: ResolvedFragmentType };

    constructor(config: ConfigType, options?: OptionsType) {
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
      this._options = options || {};
      this._currentAppName = null;
      this._initialised = false;
      this._status = this.constructor.statuses.DEFAULT;
      this._resolvedFragments = {};

      this._pathCheckers = Object.keys(apps || {}).reduce((appPathCheckers, appName) => {
        const { appPath } = apps[appName];

        if (!appPath || typeof appPath !== 'string') {
          return appPathCheckers;
        }

        return Object.assign({}, appPathCheckers, {
          [appName]: pathToRegexp(appPath),
        });
      }, {});

      const browserTitle = w.document.title;
      const browserPath = w.location.pathname;
      const browserQuery = w.location.search;

      history.replaceState({}, browserTitle, `${browserPath}${browserQuery}`);
      history.events.bind(this.constructor.events.HISTORY_STATE_CHANGE, this._handleStateChange);
    }

    _setStatus = (newStatus: $Values<typeof AppManager.statuses>): void => {
      if (this._status !== newStatus) {
        this._status = newStatus;
        history.events.trigger(this.constructor.events.STATUS_CHANGE, newStatus);
      }
    }

    _getAppFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      if (!path || typeof path !== 'string') {
        this.constructor._triggerError('get_app_from_path.no_path');
        return null;
      }

      return Object.keys(this._pathCheckers).find((appName) => {
        const pathChecker = this._pathCheckers[appName];

        if (!pathChecker) {
          this.constructor._triggerError('get_app_from_path.invalid_appPath', appName);
          return false;
        }

        return pathChecker.exec(path);
      });
    }

    _getSlotElement = (slotName: SlotNameType): ?HTMLDivElement => {
      const slot = this._slots[slotName];

      if (!slot) {
        this.constructor._triggerError('get_slot_element.no_slot', slotName);
        return null;
      }

      const element = w.document.querySelector(`.${slot.elementClass}`);

      if (!element) {
        this.constructor._triggerError('get_slot_element.no_element', slotName);
        return null;
      }

      return element;
    };

    _loadFragmentScript = async (fragmentName: FragmentNameType): Promise<?ScriptType> => {
      const fragment = this._fragments[fragmentName];

      if (!fragment) {
        this.constructor._triggerError('load_fragment_script.invalid_fragment', fragmentName);
        return null;
      }

      if (typeof fragment.load !== 'function') {
        this.constructor._triggerError('load_fragment_script.not_function', fragmentName);
        return null;
      }

      try {
        const script = await Promise.race([
          fragment.load(),
          this.constructor._timeout(this._options.importTimeout),
        ]);

        if (!script) {
          this.constructor._triggerError('load_fragment_script.no_script', fragmentName);
          return null;
        }

        if (!('version' in script)) {
          this.constructor._triggerError('load_fragment_script.invalid_script', fragmentName);
          return null;
        }

        return script;
      } catch (err) {
        this.constructor._triggerError('load_fragment_script.load', fragmentName, err);
        return null;
      }
    };

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
        this.constructor._triggerError('resolve_page_fragments.invalid_app', appName);
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
        this.constructor._triggerError('resolve_page_fragments.get', appName);
        return null;
      }

      const resolveFragmentPromises = Object.keys(pageFragments)
        .filter((slotName) => pageFragments[slotName])
        .map((slotName) => this._resolveFragment(slotName, pageFragments[slotName]));

      return Promise.all(resolveFragmentPromises);
    };

    _hydrate = (appName: AppNameType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      try {
        const slotElement = this._getSlotElement(resolvedFragment.slot);

        if (!slotElement) {
          this.constructor._triggerError('hydrate.missing_element', resolvedFragment.slot);
          return false;
        }

        const { script } = resolvedFragment;

        if (typeof script.hydrate !== 'function') {
          this.constructor._triggerError('hydrate.invalid_script', resolvedFragment.name || appName);
          return false;
        }

        const app = this._apps[appName];

        await script.hydrate(slotElement, history, app);

        return true;
      } catch (err) {
        this.constructor._triggerError('hydrate.run_script', resolvedFragment.name, err);
        return false;
      }
    };

    _unmount = (appName: AppNameType) => async (resolvedFragment: ResolvedFragmentType): Promise<?boolean> => {
      try {
        const slotElement = this._getSlotElement(resolvedFragment.slot);

        if (!slotElement) {
          this.constructor._triggerError('unmount.missing', resolvedFragment.slot);
          return false;
        }

        const { script } = resolvedFragment;

        if (typeof script.unmount !== 'function') {
          this.constructor._triggerError('unmount.invalid_script', resolvedFragment.name || appName);
          return false;
        }

        const app = this._apps[appName];

        await script.unmount(slotElement, history, app);

        return true;
      } catch (err) {
        this.constructor._triggerError('unmount.error', resolvedFragment.name || appName, err);
        return false;
      }
    };

    _mount = (appName: AppNameType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      try {
        const slotElement = this._getSlotElement(resolvedFragment.slot);

        if (!slotElement) {
          this.constructor._triggerError('mount.missing', resolvedFragment.name || appName);
          return false;
        }

        const { script } = resolvedFragment;

        if (typeof script.mount !== 'function') {
          this.constructor._triggerError('mount.invalid_script', resolvedFragment.name || appName);
          return false;
        }

        const app = this._apps[appName];

        await script.mount(slotElement, history, app);

        return true;
      } catch (err) {
        this.constructor._triggerError('mount.error', resolvedFragment.name || appName, err);
        return false;
      }
    };

    _onStateChange = (appName: AppNameType) => async (resolvedFragment: ResolvedFragmentType): Promise<boolean> => {
      try {
        const { script } = resolvedFragment;

        if (typeof script.onStateChange !== 'function') {
          this.constructor._triggerError('on_state_change.invalid_script', resolvedFragment.name || appName);
          return false;
        }

        const app = this._apps[appName];

        await script.onStateChange(history, app);

        return true;
      } catch (err) {
        this.constructor._triggerError('on_state_change.error', resolvedFragment.name || appName, err);
        return false;
      }
    };

    _hydratePage = async (): Promise<boolean> => {
      const currentAppName = this._currentAppName;

      if (!currentAppName) {
        this.constructor._triggerError('hydrate_page.missing_route');
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
        this.constructor._triggerError('hydrate_page.get_scripts', currentAppName, err);
        return false;
      }
    };

    _updatePage = async (newAppName: AppNameType): Promise<boolean> => {
      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        this.constructor._triggerError('update_page.no_current_app');
        return false;
      }

      const [oldResolvedFragments, newResolvedFragments] = await Promise.all([
        this._resolvePageFragments(oldAppName),
        this._resolvePageFragments(newAppName),
      ]);

      if (!Array.isArray(oldResolvedFragments) || !Array.isArray(newResolvedFragments) || !oldResolvedFragments.every(Boolean) || !newResolvedFragments.every(Boolean)) {
        return false;
      }

      const oldFragmentNames = oldResolvedFragments.map(({ name }) => name);
      const newFragmentNames = newResolvedFragments.map(({ name }) => name);

      const unmountPromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._unmount(oldAppName));

      const mountPromises = newResolvedFragments
        .filter((resolvedFragment) => oldFragmentNames.indexOf(resolvedFragment.name) === -1)
        .map(this._mount(newAppName));

      const onStateChangePromises = oldResolvedFragments
        .filter((resolvedFragment) => newFragmentNames.indexOf(resolvedFragment.name) > -1)
        .map(this._onStateChange(newAppName));

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
    };

    _handleStateChange = async (): Promise<boolean> => {
      if (!this._initialised) {
        this.constructor._triggerError('handle_state_change.app_not_ready');
        return false;
      }

      if (this._status === this.constructor.statuses.ERROR) {
        this.constructor._goToPath();
        return false;
      }

      this._setStatus(this.constructor.statuses.LOADING);

      const newAppName = this._getAppFromPath();

      if (!newAppName) {
        this.constructor._triggerError('handle_state_change.app_not_found');
        this._setStatus(this.constructor.statuses.ERROR);
        this.constructor._goToPath();
        return false;
      }

      try {
        const updatePageSuccess = await this._updatePage(newAppName);

        if (!updatePageSuccess) {
          this._setStatus(this.constructor.statuses.ERROR);
          this.constructor._goToPath();
          return false;
        }

        this._currentAppName = newAppName;
        this._setStatus(this.constructor.statuses.DEFAULT);

        return true;
      } catch (err) {
        this.constructor._triggerError('update_app', newAppName, err);
        this._setStatus(this.constructor.statuses.ERROR);
        this.constructor._goToPath();
        return false;
      }
    };

    init = async (): Promise<boolean> => {
      this._setStatus(this.constructor.statuses.LOADING);

      if (!Object.keys(this._slots).every((slotName) => this._getSlotElement(slotName))) {
        this.constructor._triggerError('init.missing_elements');
        this._setStatus(this.constructor.statuses.ERROR);
        return false;
      }

      const currentAppName = this._getAppFromPath();

      if (!currentAppName) {
        this.constructor._triggerError('init.no_route');
        this._setStatus(this.constructor.statuses.ERROR);
        return false;
      }

      this._currentAppName = currentAppName;

      const hydrateSuccess = await this._hydratePage();

      if (!hydrateSuccess) {
        this._setStatus(this.constructor.statuses.ERROR);
        return false;
      }

      this._initialised = true;
      this._setStatus(this.constructor.statuses.DEFAULT);

      return true;
    };
  };
}
