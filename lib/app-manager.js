// @flow

import pathToRegexp from 'path-to-regexp';

import type History from 'html5-history';

export default function initAppManager(w: WindowType, history: History) {
  return class AppManager {
    static get _browserPath(): string {
      const browserState = history.getState();
      return (browserState.hash || '').split('?')[0];
    }

    _analytics: *;
    _appScriptImports: *;
    _guestApps: *;
    _appSlots: *;
    _guestAppScripts: *;
    _pathCheckers: *;
    _currentAppName: string;
    _appScripts: { [appName: string]: () => Promise<GuestAppType> };

    constructor(config: ConfigType, analytics: Analytics) {
      if (!config) {
        throw new Error('Config not specified. Aborting.');
      }

      const {
        appScriptImports,
        guestApps,
        appSlots,
        guestAppScripts,
      } = config;

      this._analytics = analytics || { error(mock) { return mock; }, namespace: 'mock' };
      this._appScriptImports = appScriptImports;
      this._guestApps = guestApps;
      this._appSlots = appSlots;
      this._guestAppScripts = guestAppScripts;

      this._pathCheckers = Object.keys(guestApps || {}).reduce((apps, appName) => {
        const { appPath } = guestApps[appName];

        if (!appPath || typeof appPath !== 'string') {
          return apps;
        }

        return Object.assign({}, apps, {
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
      const emptyAppSlots = Object.keys(this._appSlots).reduce((emptySlots, slotName) => Object.assign(emptySlots, { [this._appSlots[slotName].name]: null }), {});
      const appDisplayScripts = this._guestApps[appName].display;

      return appDisplayScripts.reduce((scripts, displayScriptName) => {
        const guestAppScript = this._guestAppScripts[displayScriptName];

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
      const slot = this._appSlots[slotName];

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

      const appScriptImport = this._appScriptImports[appScriptName];

      if (typeof appScriptImport !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.not_function`, id: appScriptName });
        return null;
      }

      try {
        const newScript = await appScriptImport();

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
          if (!(slotName in slotScripts)) {
            this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_scripts.invalid_slot`, id: appName });
            return pageScripts;
          }

          const appScriptImportPromise = Promise.resolve()
            .then(() => this._getAppScript(slotScripts[slotName]))
            .then((appScript) => ({ script: appScript, slot: slotName, name: slotScripts[slotName] }));

          return pageScripts.concat(appScriptImportPromise);
        }, []);

      return Promise.all(appScriptImportPromises);
    };

    _hydrateScript = (currentAppName: string) => async (appScript: PageScriptType): Promise<?void> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.missing_element.${appScript.slot}`, id: appScript.name });
        return null;
      }

      const newApp = this._guestApps[currentAppName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.invalid_app`, id: currentAppName });
        return null;
      }

      if (!appScript.script || typeof appScript.script.hydrate !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.invalid_script`, id: appScript.name });
        return null;
      }

      const { script } = appScript;

      try {
        return await script.hydrate(slotElement, history, newApp);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate.run_script`, id: appScript.name });
        return null;
      }
    };

    _unmountScript = (appName: string) => async (appScript: PageScriptType): Promise<?boolean> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.missing`, id: appScript.name });
        return null;
      }

      const newApp = this._guestApps[appName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.invalid_app`, id: appName });
        return null;
      }

      if (!appScript.script || typeof appScript.script.unmount !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.invalid_script`, id: appScript.name });
        return null;
      }

      const { script } = appScript;

      try {
        return await script.unmount(slotElement, history, newApp);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.unmount.error`, id: appScript.name });
        return null;
      }
    };

    _mountScript = (appName: string) => async (appScript: PageScriptType): Promise<?void> => {
      const slotElement = this._getSlotElement(appScript.slot);

      if (!slotElement) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.missing`, id: appScript.name });
        return null;
      }

      const newApp = this._guestApps[appName];

      if (!newApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.invalid_app`, id: appName });
        return null;
      }

      if (!appScript.script || typeof appScript.script.mount !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.invalid_script`, id: appScript.name });
        return null;
      }

      const { script } = appScript;

      try {
        return await script.mount(slotElement, history, newApp);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.mount.error`, id: appScript.name });
        return null;
      }
    };

    _stateChangeScript = (appName: string) => async (appScript: PageScriptType): Promise<?void> => {
      const updateApp = this._guestApps[appName];

      if (!updateApp) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.invalid_app`, id: updateApp });
        return null;
      }

      if (!appScript.script || typeof appScript.script.onStateChange !== 'function') {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.invalid_script`, id: appScript.name });
        return null;
      }

      const { script } = appScript;

      try {
        return await script.onStateChange(history, updateApp);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.state_change.error`, id: appScript.name });
        return null;
      }
    };

    _hydratePage = async (): Promise<?Array<?void>> => {
      const currentAppName = this._currentAppName;

      if (!currentAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.missing_route` });
        return null;
      }

      try {
        const pageScripts = await this._getPageScripts(currentAppName);

        const hydratePromises = pageScripts.map(this._hydrateScript(currentAppName));

        return await Promise.all(hydratePromises);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.get_scrips`, id: currentAppName });
        return null;
      }
    };

    _updatePage = async (newAppName: string): Promise<?void> => {
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

      await Promise.all(unmountPromises);
      await Promise.all(mountPromises);
      await Promise.all(updatePromises);

      return null;
    };

    _onStateChange = async (): Promise<?void> => {
      const newAppName = this._getAppFromPath();

      if (!newAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app.app_not_found` });
        return null;
      }

      try {
        await this._updatePage(newAppName);
      } catch (err) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app`, id: newAppName });
        return null;
      }

      this._currentAppName = newAppName;

      return null;
    };

    init = async (): ?Promise<?void> => {
      if (!Object.keys(this._appSlots).every((slotName) => this._getSlotElement(slotName))) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.missing_elements` });
        return null;
      }

      if (!w.document) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.no_window` });
        return null;
      }

      const browserTitle = w.document.title;
      const browserPath = w.document.location.pathname;
      const browserQuery = w.document.location.search;

      history.replaceState({}, browserTitle, `${browserPath}${browserQuery}`);

      const currentAppName = this._getAppFromPath();

      if (!currentAppName) {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.init_app.no_route` });
        return null;
      }

      this._currentAppName = currentAppName;

      await this._hydratePage();

      history.Adapter.bind(w, 'statechange', this._onStateChange);

      return null;
    };
  };
}
