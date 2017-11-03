// @flow

// Mocha globals
declare var describe: any
declare var it: any
declare var before: any
declare var after: any
declare var beforeEach: any
declare var afterEach: any

type WindowType = any;
type Analytics = any;

type GuestPropsType = {
  name: string,
  appPath: string,
  display: Array<string>,
};

type GuestSlotsType = {
  name: string,
  elementClass: string,
};

type GuestAppScriptsType = {
  name: string,
  slots: Array<string>,
  managed: boolean,
};

interface GuestAppVersion2Type {
  version: 2;
  hydrate(container: HTMLDivElement, currentApp: GuestPropsType): Promise<?void>;
  mount(container: HTMLDivElement, currentApp: GuestPropsType): Promise<?void>;
  unmount(container: HTMLDivElement, currentApp: GuestPropsType): boolean;
  onStateChange(currentApp: GuestPropsType): Promise<?void>;
}

interface GuestAppVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: History, currentApp: GuestPropsType): Promise<?void>;
  mount(container: HTMLDivElement, history: History, currentApp: GuestPropsType): Promise<?void>;
  unmount(container: HTMLDivElement, history: History, currentApp: GuestPropsType): boolean;
  onStateChange(history: History, currentApp: GuestPropsType): Promise<?void>;
}

type GuestAppType = (GuestAppVersion2Type | GuestAppVersion3Type);

type PageScriptType = {
  script: ?GuestAppType,
  slot: string,
  name: string,
};

type ConfigType = {|
  appScriptImports: { [appName: string]: ?() => Promise<GuestAppType> },
  guestApps: { [guestApp: string]: GuestPropsType },
  appSlots: { [slot: string]: GuestSlotsType },
  guestAppScripts: { [guestAppScript: string]: GuestAppScriptsType },
|};
