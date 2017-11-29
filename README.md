[![Build Status](https://travis-ci.org/tomruttle/app-manager.svg?branch=master)](https://travis-ci.org/tomruttle/app-manager)

# app-manager

Script for managing the lifecycles of multiple apps on a single page

## Use Case

* Your app has been built with a microservices architecture.
* You are using a tool like [https://github.com/tes/compoxure](compoxure) to split the page into fragments, which are rendered on disparate servers and compiled
* Your front-end code has become sufficiently complex that it warrants splitting up and/or is isomorphically rendered
* You wish to keep your app 'feeling' like an SPA
* You are able to split your scripts and fetch them from disparate servers using a tool like [https://github.com/tes/async-define](async-define)

## API

app-manager exports a class (`AppManager`) whose constructor takes three parameters: `config`, `analytics`, and `options` such that:

```typescript
type AnalyticsErrorType = {
  eventTitle: string,
  id?: string,
};

type AnalyticsType = {
  namespace: string,
  error: (error: AnalyticsErrorType) => any,
};

type OptionsType = {
  importTimeout?: number,
};

type AppType = {
  name: string,
  appPath: string,
  display: Array<string>,
};

interface GuestAppVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  mount(container: HTMLDivElement, history: History, currentApp: AppType): Promise<?void>;
  unmount(container: HTMLDivElement, history: History, currentApp: AppType): boolean;
  onStateChange(history: History, currentApp: AppType): Promise<?void>;
}

type GuestAppType = GuestAppVersion3Type;

type SlotType = {
  name: string,
  elementClass: string,
};

type ScriptType = {
  name: string,
  slots: Array<string>,
  managed: boolean,
  load?: () => Promise<GuestAppType>,
};

type ConfigType = {|
  apps: { [app: string]: AppType },
  slots: { [slot: string]: SlotType },
  scripts: { [script: string]: ScriptType },
|};

export default class AppManager {
  constructor(config: ConfigType, analytics?: AnalyticsType, options?: OptionsType): AppManager,
  onStateChange: () => Promise<boolean>,
  init: () => Promise<boolean>,
}
```

When you have instantiated the `AppManager` class, call `init()` to initialise the page.
