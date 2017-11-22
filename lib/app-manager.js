// @flow

import pathToRegexp from 'path-to-regexp';

import type History from 'html5-history';

const DEFAULT_TIMEOUT = 4000;

export default function initAppManager(w: WindowType, history: History) {
  return class AppManager {
    static get _browserPath(): string {
      const browserState = history.getState();
      return (browserState.hash || '').split('?')[0];
    }

    _analytics: *;
    _apps: *;
    _slots: *;
    _scripts: *;
    _pathCheckers: *;
    _options: *;
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

      this._pathCheckers = Object.keys(apps || {}).reduce((appPathCheckers, appName) => {
        const { appPath } = apps[appName];

        if (!appPath || typeof appPath !== 'string') {
          return appPathCheckers;
        }

        return Object.assign({}, appPathCheckers, {
          [appName]: pathToRegexp(appPath),
        });
      }, {});
    }

    _getAppFromPath(): ?string {
      const path = AppManager._browserPath;

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

      if (typeof guestAppScript.import !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.not_function`, id: appScriptName });
        return null;
      }

      try {
        const newScript = await Promise.race([
          guestAppScript.import(),
          new Promise((resolve) => setTimeout(resolve, this._options.importTimeout || DEFAULT_TIMEOUT)),
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
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.import`, id: appScriptName });
        return null;
      }
    };

    _getPageScripts = async (appName: string): Promise<Array<PageScriptType>> => {
      const slotScripts = this._getManagedSlotScripts(appName);

      const appScriptImportPromises = Object.keys(slotScripts)
        .reduce((pageScripts, slotName) => {
          if (!slotScripts[slotName]) {
            return pageScripts;
          }

          const appScriptImportPromise = Promise.resolve()
            .then(() => this._getAppScript(slotScripts[slotName]))
            .then((appScript) => ({ script: appScript, slot: slotName, name: slotScripts[slotName] }));

          return pageScripts.concat(appScriptImportPromise);
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

        const hydratePromises = pageScripts.map(this._hydrateScript(currentAppName));

        const hydrateSuccess = await Promise.all(hydratePromises);

        return hydrateSuccess.every(Boolean);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.get_scrips`, id: currentAppName });
        return false;
      }
    };

    _updatePage = async (newAppName: string): Promise<boolean> => {
      const oldAppName = this._currentAppName;

      const [oldAppScripts, newAppScripts] = await Promise.all([
        this._getPageScripts(oldAppName),
        this._getPageScripts(newAppName),
      ]);

      const oldAppScriptNames = oldAppScripts.map(({ name }) => name);
      const newAppScriptNames = newAppScripts.map(({ name }) => name);

      const unmountPromises = oldAppScripts
        .filter((appScript) => newAppScriptNames.indexOf(appScript.name) === -1)
        .map(this._unmountScript(oldAppName));

      const mountPromises = newAppScripts
        .filter((appScript) => oldAppScriptNames.indexOf(appScript.name) === -1)
        .map(this._mountScript(newAppName));

      const updatePromises = oldAppScripts
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

      if (!w.document) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.no_window` });
        return false;
      }

      const browserTitle = w.document.title;
      const browserPath = w.document.location.pathname;
      const browserQuery = w.document.location.search;

      history.replaceState({}, browserTitle, `${browserPath}${browserQuery}`);

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

      history.Adapter.bind(w, 'statechange', this._onStateChange);

      return true;
    };
  };
}
