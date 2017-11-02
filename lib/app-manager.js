// @flow

import pathToRegexp from 'path-to-regexp';

import type History from 'html5-history';

type WindowType = any;
type Analytics = any;

type GuestPropsType = {
  name: string,
  appPath: string,
  display: Array<string>,
};

type GuestSlotsType = {
  name: string,
  layout: string,
  elementClass: string,
};

type GuestAppScriptsType = {
  name: string,
  library: string,
  slots: Array<string>,
  managed: boolean,
  permission: ?string,
};

interface GuestAppVersion2Type {
  version: 2;
  hydrate(container: HTMLDivElement, currentApp: GuestPropsType): Promise<?void>;
  onStateChange(currentApp: GuestPropsType): Promise<?void>;
  mount(container: HTMLDivElement, currentApp: GuestPropsType): Promise<?void>;
  unmount(container: HTMLDivElement): boolean;
}

type GuestAppType = GuestAppVersion2Type;

type ConfigType = {
  appScriptImports: { [appName: string]: ?() => Promise<GuestAppType | { default: GuestAppType }> },
  guestApps: { [guestApp: string]: GuestPropsType },
  appSlots: { [slot: string]: GuestSlotsType },
  guestAppScripts: { [guestAppScript: string]: GuestAppScriptsType },
};

export default class AppManager {
  _analytics: *;
  _appScriptImports: *;
  _guestApps: *;
  _appSlots: *;
  _guestAppScripts: *;
  _w: *;
  _history: *;
  _pathCheckers: *;
  _currentAppName: string;
  _appScripts: { [appName: string]: () => Promise<GuestAppType> };

  constructor(config: ConfigType, analytics: Analytics, w: WindowType, history: History) {
    const {
      appScriptImports,
      guestApps,
      appSlots,
      guestAppScripts,
    } = config;

    this._w = w;
    this._history = history;
    this._analytics = analytics;
    this._appScriptImports = appScriptImports;
    this._guestApps = guestApps;
    this._appSlots = appSlots;
    this._guestAppScripts = guestAppScripts;

    this._pathCheckers = Object.keys(guestApps || {}).reduce((apps, appName) => Object.assign({}, apps, {
      [appName]: pathToRegexp(guestApps[appName].appPath),
    }), {});
  }

  get _browserPath(): string {
    const browserState = this._history.getState();
    return (browserState.hash || '').split('?')[0];
  }

  _getAppFromPath() {
    const path = this._browserPath;
    return Object.keys(this._pathCheckers).find((appName) => this._pathCheckers[appName].exec(path));
  }

  _getManagedSlotScripts(appName: string) {
    const emptyAppSlots = Object.keys(this._appSlots).reduce((emptySlots, slotName) => Object.assign(emptySlots, { [this._appSlots[slotName].name]: null }), {});
    const appDisplayScripts = this._guestApps[appName].display;

    return appDisplayScripts.reduce((scripts, displayScriptName) => {
      const guestAppScript = this._guestAppScripts[displayScriptName];

      if (!guestAppScript.managed) {
        return scripts;
      }

      return guestAppScript.slots.reduce((scriptsInSlots, appScriptSlotName) => {
        if (scriptsInSlots.appScriptSlotName) {
          return scriptsInSlots;
        }

        return Object.assign({}, scriptsInSlots, { [appScriptSlotName]: displayScriptName });
      }, scripts);
    }, emptyAppSlots);
  }

  _getSlotElement(slotName: string): ?HTMLDivElement {
    if (!this._w) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_element.no_window`, id: slotName });
      return null;
    }

    const slot = this._appSlots[slotName];

    if (!slot) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_element.no_slot`, id: slotName });
      return null;
    }

    const element = this._w.document.querySelector(`.${slot.elementClass}`);

    if (!element) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_element.no_element`, id: slotName });
      return null;
    }

    return element;
  }

  _getAppScript(appScriptName: string): Promise<?GuestAppType> {
    if (this._appScripts && this._appScripts[appScriptName]) {
      return this._appScripts[appScriptName]();
    }

    const appScriptImport = this._appScriptImports[appScriptName];

    if (typeof appScriptImport !== 'function') {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.not_function`, id: appScriptName });
      return Promise.resolve(null);
    }

    return Promise.resolve()
      .then(() => appScriptImport)
      .catch((err) => {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.import`, id: appScriptName });
        throw err;
      })
      .then((file) => {
        if (!file) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.no_file`, id: appScriptName });
          return null;
        }

        const newScript: GuestAppType = file.default || file;

        if (!('version' in newScript)) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.get_script.invalid_script`, id: appScriptName });
          return null;
        }

        this._appScripts = Object.assign({}, this._appScripts, {
          [appScriptName]: () => Promise.resolve(newScript),
        });

        return newScript;
      })
      .catch(() => null);
  }

  _getPageScripts(appName: string): Promise<Array<{ script: ?GuestAppType, slot: string, name: string }>> {
    const slotScripts = this._getManagedSlotScripts(appName);

    const appScriptImports = Object.keys(slotScripts)
      .filter((slotName) => Boolean(slotScripts[slotName]))
      .map((slotName) => this._getAppScript(slotScripts[slotName])
        .then((appScript) => ({ script: appScript, slot: slotName, name: slotScripts[slotName] })));

    return Promise.all(appScriptImports);
  }

  _hydratePage(): Promise<?void> {
    const currentAppName = this._currentAppName;

    if (!currentAppName) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.missing_route` });
      return Promise.resolve(null);
    }

    return this._getPageScripts(currentAppName)
      .then((pageScripts) => pageScripts.map((appScript) => {
        const slotElement = this._getSlotElement(appScript.slot);

        if (!slotElement) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.missing_element.${appScript.slot}`, id: appScript.name });
          return null;
        }

        return Promise.resolve()
          .then(() => {
            if (!appScript.script || typeof appScript.script.hydrate !== 'function') {
              return null;
            }

            return appScript.script.hydrate(slotElement, this._guestApps[currentAppName]);
          })
          .catch(() => {
            this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page.run_script`, id: appScript.name });
          });
      }))
      .then(() => null)
      .catch(() => {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.hydrate_page`, id: currentAppName });
      });
  }

  _updatePage(newAppName: string): Promise<?void> {
    const oldAppName = this._currentAppName;

    return Promise.all([this._getPageScripts(oldAppName), this._getPageScripts(newAppName)])
      .then(([oldAppScripts, newAppScripts]) => {
        const oldAppScriptNames = oldAppScripts.map(({ name }) => name);
        const newAppScriptNames = newAppScripts.map(({ name }) => name);

        const unmountPromises = oldAppScripts
          .filter((appScript) => !newAppScriptNames.includes(appScript.name))
          .map((appScript) => Promise.resolve()
            .then(() => {
              const slotElement = this._getSlotElement(appScript.slot);

              if (!slotElement || !appScript.script || typeof appScript.script.unmount !== 'function') {
                return null;
              }

              return appScript.script.unmount(slotElement);
            })
            .catch(() => {
              this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_page.unmount_script`, id: appScript.name });
            }));

        const mountPromises = newAppScripts
          .filter((appScript) => !oldAppScriptNames.includes(appScript.name))
          .map((appScript) => Promise.resolve()
            .then(() => {
              const slotElement = this._getSlotElement(appScript.slot);
              const newApp = this._guestApps[newAppName];

              if (!slotElement || !newApp || !appScript.script || typeof appScript.script.mount !== 'function') {
                return null;
              }

              return appScript.script.mount(slotElement, newApp);
            })
            .catch(() => {
              this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_page.mount_script`, id: appScript.name });
            }));

        const updatePromises = oldAppScripts
          .filter((appScript) => newAppScriptNames.includes(appScript.name))
          .map((appScript) => Promise.resolve()
            .then(() => {
              const updateApp = this._guestApps[newAppName];

              if (!updateApp || !appScript.script || typeof appScript.script.onStateChange !== 'function') {
                return null;
              }

              return appScript.script.onStateChange(updateApp);
            })
            .catch(() => {
              this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_page.onstatechange_script`, id: appScript.name });
            }));

        return Promise.all(unmountPromises)
          .then(() => Promise.all(mountPromises))
          .then(() => Promise.all(updatePromises));
      })
      .then(() => null);
  }

  _onStateChange(): Promise<?void> {
    const newAppName = this._getAppFromPath();

    return Promise.resolve()
      .then(() => {
        if (!newAppName) {
          this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app.app_not_found` });
          return null;
        }

        return this._updatePage(newAppName)
          .then(() => { this._currentAppName = newAppName; });
      })
      .catch(() => {
        this._analytics.error({ eventTitle: `${this._analytics.namespace}.update_app`, id: newAppName });
      });
  }

  init(): ?Promise<void> {
    if (!Object.keys(this._appSlots).every((slotName) => this._getSlotElement(slotName))) {
      return null;
    }

    if (!this._w || !this._w.document) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.init.no_window` });
      return null;
    }

    const browserTitle = this._w.document.title;
    const browserPath = this._w.document.location.pathname;
    const browserQuery = this._w.document.location.search;

    this._history.replaceState({}, browserTitle, `${browserPath}${browserQuery}`);

    const currentAppName = this._getAppFromPath();

    if (!currentAppName) {
      this._analytics.error({ eventTitle: `${this._analytics.namespace}.init_app.no_route` });
      return null;
    }

    this._currentAppName = currentAppName;

    return this._hydratePage()
      .then(() => {
        this._history.Adapter.bind(this._w, 'statechange', this._onStateChange);

        const { documentElement } = this._w.document;

        if (documentElement) {
          documentElement.classList.add('t-react-rendered');
        }
      });
  }
}
