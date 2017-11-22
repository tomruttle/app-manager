// @flow

import pathToRegexp from 'path-to-regexp';

import type History from 'html5-history';

type WindowType = any;

export type AnalyticsType = any;

export type OptionsType = {
  importTimeout?: number,
};

export type AppType = {
  name: string,
  appPath: string,
  display: Array<string>,
};

export interface GuestAppVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  mount(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  unmount(container: HTMLDivElement, history: History, currentApp: AppType): boolean;
  onStateChange(history: History, currentApp: AppType): Promise<?void>;
}

export type GuestAppType = GuestAppVersion3Type;

export type SlotType = {
  name: string,
  elementClass: string,
};

export type ScriptType = {
  name: string,
  slots: Array<string>,
  managed: boolean,
  load?: () => Promise<GuestAppType>,
};

export type PageScriptType = {
  script: ?GuestAppType,
  slot: string,
  name: string,
};

export type ConfigType = {|
  apps: { [app: string]: AppType },
  slots: { [slot: string]: SlotType },
  scripts: { [script: string]: ScriptType },
|};


const DEFAULT_TIMEOUT = 4000;

export default function initAppManager(w: WindowType, history: History) {
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
    _initialised: boolean;
    _currentAppName: string;
    _appScripts: { [appName: string]: () => Promise<GuestAppType> };

    constructor(config: ConfigType, analytics: AnalyticsType, options: OptionsType = {}) {
      if (!config) {
        throw new Error('Config not specified. Aborting.');
      }

      const { apps, slots, scripts } = config;

      this._analytics = analytics || { error(mock) { return mock; }, namespace: 'mock' };
      this._apps = apps;
      this._slots = slots;
      this._scripts = scripts;
      this._options = options;
      this._initialised = false;

      this._pathCheckers = Object.keys(apps || {}).reduce((appPathCheckers, appName) => {
        const { appPath } = apps[appName];

        if (!appPath || typeof appPath !== 'string') {
          return appPathCheckers;
        }

        return Object.assign({}, appPathCheckers, {
          [appName]: pathToRegexp(appPath),
        });
      }, {});

      if (!w.document) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.no_window` });
        return false;
      }

      const browserTitle = w.document.title;
      const browserPath = w.document.location.pathname;
      const browserQuery = w.document.location.search;

      history.replaceState({}, browserTitle, `${browserPath}${browserQuery}`);
      history.Adapter.bind(w, 'statechange', this._onStateChange);
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

    _getManagedSlotScripts = (appName: string): { [appSlot: string]: string } => {
      const emptyAppSlots = Object.keys(this._slots).reduce((emptySlots, slotName) => Object.assign(emptySlots, { [this._slots[slotName].name]: null }), {});
      const appDisplayScripts = this._apps[appName].display;

      return appDisplayScripts.reduce((scripts, displayScriptName) => {
        const guestAppScript = this._scripts[displayScriptName];

        if (!guestAppScript.managed) {
          return scripts;
        }

        return guestAppScript.slots.reduce((scriptsInSlots, appScriptSlotName) => {
          if (!(appScriptSlotName in scriptsInSlots) || scriptsInSlots.appScriptSlotName) {
            return scriptsInSlots;
          }

          return Object.assign({}, scriptsInSlots, { [appScriptSlotName]: displayScriptName });
        }, scripts);
      }, emptyAppSlots);
    };

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

    _getAppScript = async (appScriptName: string): Promise<?GuestAppType> => {
      if (this._appScripts && this._appScripts[appScriptName]) {
        return this._appScripts[appScriptName]();
      }

      const guestAppScript = this._scripts[appScriptName];

      if (!guestAppScript) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.missing`, id: appScriptName });
        return null;
      }

      if (typeof guestAppScript.load !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.not_function`, id: appScriptName });
        return null;
      }

      try {
        const newScript = await Promise.race([
          guestAppScript.load(),
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
      const appScript = await this._getAppScript(slotScripts[slotName]);

      return appScript ? { script: appScript, slot: slotName, name: slotScripts[slotName] } : null;
    }

    _getPageScripts = async (appName: string): Promise<Array<?PageScriptType>> => {
      const slotScripts = this._getManagedSlotScripts(appName);

      const appScriptImportPromises = Object.keys(slotScripts)
        .reduce((pageScripts, slotName) => {
          if (!slotScripts[slotName]) {
            return pageScripts;
          }

          return pageScripts.concat(this._getPageScript(slotScripts, slotName));
        }, []);

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

        if (!pageScripts.every(Boolean)) {
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

      const [oldAppScripts, newAppScripts] = await Promise.all([
        this._getPageScripts(oldAppName),
        this._getPageScripts(newAppName),
      ]);

      if (!oldAppScripts.every(Boolean) || !newAppScripts.every(Boolean)) {
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

    _onStateChange = async (): Promise<boolean> => {
      if (!this._initialised) {
        return false;
      }

      const newAppName = this._getAppFromPath();

      if (!newAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app.app_not_found` });
        return false;
      }

      try {
        const updatePageSuccess = await this._updatePage(newAppName);

        if (!updatePageSuccess) {
          return false;
        }

        this._currentAppName = newAppName;

        return true;
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app`, id: newAppName });
        return false;
      }
    };

    init = async (): Promise<boolean> => {
      if (!Object.keys(this._slots).every((slotName) => this._getSlotElement(slotName))) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.missing_elements` });
        return false;
      }

      const currentAppName = this._getAppFromPath();

      if (!currentAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init_app.no_route` });
        return false;
      }

      this._currentAppName = currentAppName;

      const hydrateSuccess = await this._hydratePage();

      if (!hydrateSuccess) {
        return false;
      }

      this._initialised = true;

      return true;
    };
  };
}
