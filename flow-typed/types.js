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

type AppType = {
  name: string,
  appPath: string,
  display: Array<string>,
};

type SlotType = {
  name: string,
  elementClass: string,
};

type ScriptType = {
  name: string,
  slots: Array<string>,
  managed: boolean,
  import?: () => Promise<GuestAppType>,
};

interface GuestAppVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  mount(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  unmount(container: HTMLDivElement, history: History, currentApp: AppType): boolean;
  onStateChange(history: History, currentApp: AppType): Promise<?void>;
}

type GuestAppType = GuestAppVersion3Type;

type PageScriptType = {
  script: ?GuestAppType,
  slot: string,
  name: string,
};

type ConfigType = {|
  apps: { [app: string]: AppType },
  slots: { [slot: string]: SlotType },
  scripts: { [script: string]: ScriptType },
|};
