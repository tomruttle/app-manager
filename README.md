[![Build Status](https://travis-ci.org/tomruttle/app-manager.svg?branch=master)](https://travis-ci.org/tomruttle/app-manager)

# app-manager

Script for managing the lifecycles of multiple apps on a single page

## Use Case

  * Your app has been built with a microservices architecture.
  * You are using a tool like [compoxure](https://github.com/tes/compoxure) to split the page into fragments, which are rendered on disparate servers and compiled
  * Your front-end code has become sufficiently complex that it warrants splitting up and/or is isomorphically rendered
  * You wish to keep your app 'feeling' like an SPA
  * You are able to split your scripts and fetch them from disparate servers using a tool like [async-define](https://github.com/tes/async-define)

## Concepts

### App

Each app must have a unique `appPath` (analogous to an express route) which is used by `app-manager` to determine which app should be displayed at a given time.

An `app` also has an ordered array of `scripts` that should be mounted onto the page and initialised when the user browses to the `appPath`.

### Script

A `script` is the container for your `fragment`. It includes:

  * `load`: a function that loads your `fragment` when called
  * `managed`: a boolean that tells `app-manager` whether to treat this fragment as part of the SPA
  * `slots`: an ordered array of `slots` which tell the `app` where in the DOM to render the `fragment`

### Slot

A `slot` is a wrapper for a DOM element on a page. You can split your page into as many `slots` as you please. All it requires is a unique element class.

The slot-matching algorithm will try to place as many fragments onto a page as it can without clashing (priority dictated by the order of the `scripts` array), and will try to put the `fragments` into their preferred `slots` (as dictated by the order of the `slots` array).

### Fragment

A `fragment` is the entry-point to your code. It needs to conform to a particular interface (as specified below) in order to be managed by `app-manger`, which corresponds to the lifecycle of the page.

## Lifecycle

There are four events that `app-manager` handles. Your `fragment` must provide a handler for each of them (an identity function is fine.):

  * `hydrate`: Called on first page load. If you are rendering your app isomorphically, you will likely need to grab the initial state of your `fragments` from the DOM.
  * `unmount`: Called when the user browses away from an app, and `fragments` are to be unloaded from the page. Useful to clear up any event listeners, and to reset any mutable state.
    * If you are using React, you will need to call `ReactDOM.unmountComponentAtNode` in order to free up the `slot`.
  * `mount`: Called when you browse to the `appPath` of a new app. The page will not refresh when the new set of `scripts` load the required `fragments`, so any initial state much be fetched by xhr.
  * `onStateChange`: Called when `history` detects a change in the browser state. This event will calculate if the `app` has changed, and if so, decide which `fragments` to unmount and which to mount in their place.

## Dependencies

### path-to-regexp

This is the same library Express uses to parse route paths, so if you have used Express you should be familiar with the syntax (`/path/:param(valid|options)/:optional?`). `app-manager` uses it to determine which `app` to display, and to extract url parameters.

[https://github.com/pillarjs/path-to-regexp](https://github.com/pillarjs/path-to-regexp)

### history.js

Cross-browser HTML5 history implementation, with a little extra on top (events system, state). Detects changes in browser state and calls the appropriate lifecycle methods in response. The live instance of the `history` object is passed down to each `fragment` through the lifecycle functions, so your `fragments` can mutate the browser state themselves.

[https://github.com/browserstate/history.js/](https://github.com/browserstate/history.js/)

### slot-finder

A small script that provides the algorithm to decide which script goes in which slot.

[https://github.com/tomruttle/slot-finder](https://github.com/tomruttle/slot-finder)

## API

`app-manager` exports a class `AppManager` whose constructor takes three parameters: `config`, `analytics`, and `options`:

```typescript
type AppNameType = string;
type SlotNameType = string;
type ScriptNameType = string;

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
  name: AppNameType,
  appPath: string,
  scripts: Array<ScriptNameType>,
};

interface HistoryType {
  pushState(data: ?Object, title?: ?string, href?: string): void;
  replaceState(data: ?Object, title?: ?string, href?: string): void;
  getState(): Object;
  back(): void;
  forward(): void;
  events: {
    bind(event: string, id: string, callback: Function): void,
    unbind(event: string, id: string): void,
    trigger(event: string, data?: mixed): void
  }
}

interface FragmentVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: HistoryType, currentApp: AppType): Promise<?void>;
  mount(container: HTMLDivElement, history: HistoryType, currentApp: AppType): Promise<?void>;
  unmount(container: HTMLDivElement, history: HistoryType, currentApp: AppType): boolean;
  onStateChange(history: HistoryType, currentApp: AppType): Promise<?void>;
}

type FragmentType = FragmentVersion3Type;

type SlotType = {
  name: SlotNameType,
  elementClass: string,
};

type ScriptType = {
  name: ScriptNameType,
  slots: Array<SlotNameType>,
  managed: boolean,
  load?: () => Promise<FragmentType>,
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

When you have instantiated the `AppManager` class, call `init()` to initialise the page and `mount` all of the appropriate `fragments`.
