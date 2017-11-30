// @flow

import pathToRegexp from 'path-to-regexp';
import slotFinder from 'slot-finder';

import type History from 'html5-history';
import type { HistoryType, FragmentType, AnalyticsType, OptionsType, ConfigType } from './index';

import decorateHistory from './utils/decorate-history';

type WindowType = any;

type PageScriptType = {
  script: ?FragmentType,
  slot: string,
  name: string,
};

const DEFAULT_TIMEOUT = 4000;
const HISTORY_STATE_CHANGE = 'statechange';
const APP_MANAGER_ID = 'app-manager';

const appStatuses = {
  DEFAULT: 'DEFAULT',
  LOADING: 'LOADING',
  ERROR: 'ERROR',
};

export default function initAppManager(w: WindowType, html5History: History) {
  const history: HistoryType = decorateHistory(w, html5History);

  return class AppManager {
    static _getBrowserPath(): string {
      const browserState = history.getState();
      return (browserState.hash || '').split('?')[0];
    }

    static _timeout(timeout: number = DEFAULT_TIMEOUT): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    _analytics: *;
    _apps: *;
    _slots: *;
    _scripts: *;
    _pathCheckers: *;
    _options: *;
    _status: $Keys<typeof appStatuses>;
    _initialised: boolean;
    _currentAppName: ?string;
    _appScripts: { [appName: string]: () => Promise<FragmentType> };

    constructor(config: ConfigType, analytics?: AnalyticsType, options?: OptionsType) {
      if (!config) {
        throw new Error('Config not specified. Aborting.');
      }

      if (!w.document || !w.location) {
        throw new Error('Invalid window object. Aborting.');
      }

      const { apps, slots, scripts } = config;

      this._analytics = analytics || { error(mock) { return mock; }, namespace: 'mock' };
      this._apps = apps;
      this._slots = slots;
      this._options = options || {};
      this._currentAppName = null;
      this._initialised = false;
      this._status = appStatuses.DEFAULT;
      this._scripts = Object.keys(scripts || {}).reduce((mangedScripts, scriptName) => (
        scripts[scriptName].managed
          ? Object.assign({}, mangedScripts, { [scriptName]: scripts[scriptName] })
          : mangedScripts
      ), {});

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
      history.events.bind(HISTORY_STATE_CHANGE, APP_MANAGER_ID, this.onStateChange);
    }

    _setStatus = (newStatus: $Keys<typeof appStatuses>): void => {
      if (this._status !== newStatus) {
        this._status = newStatus;
        history.events.trigger('statuschange', newStatus);
      }
    }

    _getAppFromPath = (): ?string => {
      const path = this.constructor._getBrowserPath();

      if (!path || typeof path !== 'string') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_app_from_path.no_path` });
        return null;
      }

      return Object.keys(this._pathCheckers).find((appName) => {
        const pathChecker = this._pathCheckers[appName];

        if (!pathChecker) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_app_from_path.invalid_appPath`, id: appName });
          return false;
        }

        return pathChecker.exec(path);
      });
    }

    _getSlotElement = (slotName: string): ?HTMLDivElement => {
      const slot = this._slots[slotName];

      if (!slot) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_element.no_slot`, id: slotName });
        return null;
      }

      const element = w.document.querySelector(`.${slot.elementClass}`);

      if (!element) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_element.no_element`, id: slotName });
        return null;
      }

      return element;
    };

    _getAppScript = async (appScriptName: string): Promise<?FragmentType> => {
      if (!appScriptName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.no_script_name` });
        return null;
      }

      if (this._appScripts && this._appScripts[appScriptName]) {
        return this._appScripts[appScriptName]();
      }

      const fragmentScript = this._scripts[appScriptName];

      if (!fragmentScript) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.missing`, id: appScriptName });
        return null;
      }

      if (typeof fragmentScript.load !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.not_function`, id: appScriptName });
        return null;
      }

      try {
        const newScript = await Promise.race([
          fragmentScript.load(),
          this.constructor._timeout(this._options.importTimeout),
        ]);

        if (!newScript) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.no_file`, id: appScriptName });
          return null;
        }

        if (!('version' in newScript)) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.invalid_script`, id: appScriptName });
          return null;
        }

        this._appScripts = Object.assign({}, this._appScripts, {
          [appScriptName]: async () => newScript,
        });

        return newScript;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.load`, id: appScriptName });
        return null;
      }
    };

    _getPageScript = async (slotScripts: { [appSlot: string]: string }, slotName: string): Promise<?PageScriptType> => {
      const slotScriptName = slotScripts[slotName];

      if (!slotScriptName) {
        return null;
      }

      const appScript = await this._getAppScript(slotScriptName);

      return appScript ? { script: appScript, slot: slotName, name: slotScriptName } : null;
    }

    _getSlotScripts(appName: string) {
      const appScripts = this._apps[appName].scripts.map((scriptName) => this._scripts[scriptName]);
      const emptySlots = Object.keys(this._slots).reduce((empty, slotName) => Object.assign({}, empty, { [slotName]: null }), {});

      return slotFinder(emptySlots, appScripts);
    }

    _getPageScripts = async (appName: string): Promise<?Array<?PageScriptType>> => {
      const slotScripts = this._getSlotScripts(appName);

      if (typeof slotScripts !== 'object') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_page_scripts.get`, id: appName });
        return null;
      }

      const appScriptImportPromises = Object.keys(slotScripts).map((slotName) => this._getPageScript(slotScripts, slotName));

      return Promise.all(appScriptImportPromises);
    };

    _hydrateScript = (appName: string) => async (appScript: PageScriptType): Promise<boolean> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.missing_element.${appScript.slot}`, id: appScript.name || appName });
        return false;
      }

      const newApp = this._apps[appName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.invalid_app`, id: appName });
        return false;
      }

      if (!appScript.script) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.missing_script`, id: appName });
        return false;
      }

      if (typeof appScript.script.hydrate !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.invalid_script`, id: appScript.name || appName });
        return false;
      }

      const { script } = appScript;

      try {
        await script.hydrate(slotElement, history, newApp);

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.run_script`, id: appScript.name });
        return false;
      }
    };

    _unmountScript = (appName: string) => async (appScript: PageScriptType): Promise<?boolean> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.missing`, id: appScript.name });
        return false;
      }

      const newApp = this._apps[appName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.invalid_app`, id: appName });
        return false;
      }

      if (!appScript.script) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.missing_script`, id: appName });
        return false;
      }

      if (typeof appScript.script.unmount !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.invalid_script`, id: appScript.name || appName });
        return false;
      }

      const { script } = appScript;

      try {
        await script.unmount(slotElement, history, newApp);

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.error`, id: appScript.name || appName });
        return false;
      }
    };

    _mountScript = (appName: string) => async (appScript: PageScriptType): Promise<boolean> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.missing`, id: appScript.name || appName });
        return false;
      }

      const newApp = this._apps[appName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.invalid_app`, id: appName });
        return false;
      }

      if (!appScript.script) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.missing_script`, id: appName });
        return false;
      }

      if (typeof appScript.script.mount !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.invalid_script`, id: appScript.name || appName });
        return false;
      }

      const { script } = appScript;

      try {
        await script.mount(slotElement, history, newApp);

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.error`, id: appScript.name || appName });
        return false;
      }
    };

    _stateChangeScript = (appName: string) => async (appScript: PageScriptType): Promise<boolean> => {
      const updateApp = this._apps[appName];

      if (!updateApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.invalid_app`, id: appName });
        return false;
      }

      if (!appScript.script) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.missing_script`, id: appName });
        return false;
      }

      if (typeof appScript.script.onStateChange !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.invalid_script`, id: appScript.name || appName });
        return false;
      }

      const { script } = appScript;

      try {
        await script.onStateChange(history, updateApp);

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.error`, id: appScript.name || appName });
        return false;
      }
    };

    _hydratePage = async (): Promise<boolean> => {
      const currentAppName = this._currentAppName;

      if (!currentAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.missing_route` });
        return false;
      }

      try {
        const pageScripts = await this._getPageScripts(currentAppName);

        if (!Array.isArray(pageScripts) || !pageScripts.every(Boolean)) {
          return false;
        }

        const scripts: Array<PageScriptType> = (pageScripts: any);

        const hydratePromises = scripts.map(this._hydrateScript(currentAppName));

        const hydrateSuccess = await Promise.all(hydratePromises);

        return hydrateSuccess.every(Boolean);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.get_scripts`, id: currentAppName });
        return false;
      }
    };

    _updatePage = async (newAppName: string): Promise<boolean> => {
      const oldAppName = this._currentAppName;

      if (!oldAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_page.no_current_app` });
        return false;
      }

      const [oldAppScripts, newAppScripts] = await Promise.all([
        this._getPageScripts(oldAppName),
        this._getPageScripts(newAppName),
      ]);

      if (!Array.isArray(oldAppScripts) || !Array.isArray(newAppScripts) || !oldAppScripts.every(Boolean) || !newAppScripts.every(Boolean)) {
        return false;
      }

      const oldScripts: Array<PageScriptType> = (oldAppScripts: any);
      const newScripts: Array<PageScriptType> = (newAppScripts: any);

      const oldAppScriptNames = oldScripts.map(({ name }) => name);
      const newAppScriptNames = newScripts.map(({ name }) => name);

      const unmountPromises = oldScripts
        .filter((appScript) => newAppScriptNames.indexOf(appScript.name) === -1)
        .map(this._unmountScript(oldAppName));

      const mountPromises = newScripts
        .filter((appScript) => oldAppScriptNames.indexOf(appScript.name) === -1)
        .map(this._mountScript(newAppName));

      const updatePromises = oldScripts
        .filter((appScript) => newAppScriptNames.indexOf(appScript.name) > -1)
        .map(this._stateChangeScript(newAppName));

      const unmountSuccess = await Promise.all(unmountPromises);

      if (!unmountSuccess.every(Boolean)) {
        return false;
      }

      const mountSuccess = await Promise.all(mountPromises);

      if (!mountSuccess.every(Boolean)) {
        return false;
      }

      const updateSuccess = await Promise.all(updatePromises);

      if (!updateSuccess.every(Boolean)) {
        return false;
      }

      return true;
    };

    _goToPath(): boolean {
      try {
        history.events.unbind(HISTORY_STATE_CHANGE, APP_MANAGER_ID);

        const newPath = this.constructor._getBrowserPath();
        w.location.href = newPath; // eslint-disable-line no-param-reassign
        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.go_to_path.update_href` });
        return false;
      }
    }

    onStateChange = async (): Promise<boolean> => {
      if (!this._initialised) {
        return false;
      }

      if (this._status === appStatuses.ERROR) {
        this._goToPath();
        return false;
      }

      this._setStatus(appStatuses.LOADING);

      const newAppName = this._getAppFromPath();

      if (!newAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app.app_not_found` });
        this._setStatus(appStatuses.ERROR);
        this._goToPath();
        return false;
      }

      try {
        const updatePageSuccess = await this._updatePage(newAppName);

        if (!updatePageSuccess) {
          this._setStatus(appStatuses.ERROR);
          this._goToPath();
          return false;
        }

        this._currentAppName = newAppName;
        this._setStatus(appStatuses.DEFAULT);

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app`, id: newAppName });
        this._setStatus(appStatuses.ERROR);
        this._goToPath();
        return false;
      }
    };

    _initError = (type?: string): boolean => {
      if (type) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.${type}` });
      }

      this._setStatus(appStatuses.ERROR);
      history.events.unbind(HISTORY_STATE_CHANGE, APP_MANAGER_ID);
      return false;
    }

    init = async (): Promise<boolean> => {
      this._setStatus(appStatuses.LOADING);

      if (!Object.keys(this._slots).every((slotName) => this._getSlotElement(slotName))) {
        return this._initError('missing_elements');
      }

      const currentAppName = this._getAppFromPath();

      if (!currentAppName) {
        return this._initError('no_route');
      }

      this._currentAppName = currentAppName;

      const hydrateSuccess = await this._hydratePage();

      if (!hydrateSuccess) {
        return this._initError();
      }

      this._initialised = true;
      this._setStatus(appStatuses.DEFAULT);

      return true;
    };
  };
}
