[![Build Status](https://travis-ci.org/tomruttle/app-manager.svg?branch=master)](https://travis-ci.org/tomruttle/app-manager)

# app-manager

Script for managing the lifecycles of multiple apps on a single page

## Use Case

  * Your app has been built with a microservices architecture.
  * Your front-end code has become sufficiently complex that it warrants splitting up and/or is isomorphically rendered
  * You wish to keep your app 'feeling' like an SPA

## Minimal Example

### config.js

```js
export default {
  slots: {
    APP: {
      querySelector: '.app',
    },
  },

  fragments: {
    EXAMPLE1_FRAGMENT: {
      slot: 'APP',
      async loadScript(state) {
        return fetchScriptForExample1(state);
      },
      async ssrGetMarkup(querySelector, state, query) {
        return /* @html */`
          <div class="${querySelector.slice(1)}">
            ${await fetchMarkupForExample1(state, query)}
          </div>
        `;
      },
    },

    EXAMPLE2_FRAGMENT: {
      slot: 'APP',
      async loadScript(state) {
        return fetchScriptForExample2(state);
      },
      async ssrGetMarkup(querySelector, state, query) {
        return /* @html */`
          <div class="${querySelector.slice(1)}">
            ${await fetchMarkupForExample2(state, query)}
          </div>
        `;
      },
    }
  },

  routes: {
    EXAMPLE1_APP: {
      path: '/apps/example1',
      fragment: 'EXAMPLE1_FRAGMENT',
    },

    EXAMPLE2_APP: {
      path: '/apps/example2',
      fragment: 'EXAMPLE2_FRAGMENT',
    }
  }
}
```

### client.js

```js
import appManager from 'app-manager';

import config from './config';

// ...

const options = {
  importTimeout: 3000,
};

appManager(config, eventEmitter, options);
```

### server.js

```js
import appManagerServer from 'app-manager/server';

import config from './config';

const { getSlotsMarkup } = appManagerServer(config);

// ...

app.get('/apps/*', async (req, res, next) => {
  try {
    const renderedMarkup = await getSlotsMarkup(req.originalUrl, req.query);

    return res.send(/* @html */`
      <!DOCTYPE html>
      <html>
        <body>
          ${renderedMarkup.APP}
          <script src="/static/main.js"></script>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});
```

## Api

`app-manager` exports a function that takes three parameters:

* `config` - describes your app to app-manager
* `events` - a event emitter module with the same API as the native node.js module
* `options` - Optional options object

## Config

An object containing maps of the slots, fragments, and routes that comprise your app.

```js
{
  slots: {
    SLOT_NAME: slot, // As below
  },
  fragments: {
    FRAGMENT_NAME: fragment, // As below
  },
  routes: {
    ROUTE_NAME: route, // As below
  },
}
```

### State

The state object is passed as a parameter into almost every function within and without app-manager. It contains the useful current state of the browser and the derived state of the application.

```js
{
  resource: '/app/some-path?query=value', // The pathname and query string currently displayed in the browser
  title: 'My Page', // The current document page title
  historyState: null, // The current contents of the history state object
  eventTitle: 'hc-initialise', // The name of the event (as below) that caused the current action to occur
  route, // The config for the current route (as below)
  prevRoute, // The config for the route that was previous to the current one. Is null when app is first loaded.
  ...additionalState, // Any additional state returned from the getAdditionalState function passed into options (as below)
}
```

### Route

A `route` determines which fragments are displayed on which `path`.

```js
{
  path: '/app/:path', // Path or...
  paths: ['/app/:path1', '/app/:path2'], // ...paths that uniquely identifies this app. Analogous to a route in express.
  fragment: 'FRAGMENT_NAME', // Fragment name or...
  fragments: ['APP_FRAGMENT_NAME', 'HEADER_FRAGMENT_NAME'], // ...ordered array of fragment names to be displayed for that route. If two fragments occupy the same slot, the first will take precedence.
}
```

### Slot

A `slot` is a wrapper for a DOM element on a page.

```js
{
  querySelector: '.app', // Uniquely returns a single DOM element when passed to document.querySelector.
  async getLoadingMarkup(state) {
    // Optional function that should return some markup to be displayed in a slot between a fragment being unmounted and a new one being mounted in its place.

    return /* @html */`<img src="/spinner.gif" alt="Loading ${state.route.name}" />`
  },
  async getErrorMarkup(state) {
    // Optional function that returns a markup string to be displayed in a slot if one of the lifecycle methods for a script throws an error.

    return /* @html */`<p class="error">An error occurred while browsing to ${state.route.name}.`;
  },
  async ssrGetErrorMarkup(querySelector, state, ...otherArgs) {
    // Optional function that's called if options.ssrHaltOnError is false and ssrGetMarkup for a fragment which is being loaded into this slot throws an error. Should return a markup string.

    return /* @html */`
      <div class="${querySelector.slice(1)}">
        <p class="error">An error occurred while loading ${state.route.name}.</p>
      </div>
    `;
  },
},
```

### Fragment

A `fragment` is the container for your `script`.

```js
{
  slot: 'SLOT_NAME', // Slot name or...
  slots: ['LEFT_SLOT_NAME', 'RIGHT_SLOT_NAME'], // ...ordered array of slot names. Fragment will be loaded in the first empty slot possible.
  async loadScript(state) {
    // * Optional function (only needed if using app-manager to manage client-side lifecycle) that fetches the script (as below) for your fragment.

    // ...

    return script;
  },
  async ssrGetMarkup(querySelector, state, ...otherArgs) {
    // * Optional function (only needed if using app-manager for server-side rendering) that fetches the markup needed to render your fragment into a DOM.
    // * Should contain any serialised app state you wish to use to hydrate the app on the client, any inline styles, etc.
    // * Function is called with the querySelector of the slot into which it is being mounted, state (as below), and any arguments you pass into the 'appManagerServer.getSlotsMarkup' function.

    // ...

    return markupString;
  },
}
```

### Script

A `script` is the entry-point to your code.

It should contain the lifecycle methods to be called as the user browses around your site:

```js
{
  version: 6 // Lets app-manager know which schema to expect from your script
  async hydrate(container, state) {
    // * Optional function that will be called if the parent fragment is included on the page on first load
    // * If rendering your app isomorphically, you will likely wish to read app state from the DOM here.
    // * Function is called with the element into which the fragment is to be mounted and state (as below)

    const appState = window['__your_app_state__']
    ReactDOM.hydrate(container, <YourApp {...appState} />);
  },
  async render(container, state) {
    // * Optional function that will be called if the user browses onto an path for which the parent fragment is to be mounted.
    // * If your app relies on initial state, you should fetch it here
    // * Function is called with the element into which the fragment is to be mounted and state (as below)

    const props = await getInitialStateFromServer(state.params);

    ReactDOM.render(container, <YourApp {...props} />);
  },
  async onStateChange(container, state) {
    // * Optional function that will be called when an event is fired from the history api, and the fragment is to remain mounted on the page
    // * If your fragment has multiple views that should be routed between (for example with path params), this lifecycle method will be where routing is managed.
    // * Function is called with state (as below)

    await updateAppState(state);
  },
  async unmount(container, state) {
    // * Optional function that will be called when the user browses away from an path on which the parent fragment is mounted.
    // * Useful to clear up any event listeners, and to reset any mutable state.
    // * Function is called with the element into which the fragment is to be mounted and state (as below)

    ReactDOM.unmountComponentAtNode(container);
  },
}
```

## Events

Suggested: [EventEmitter3](https://github.com/primus/eventemitter3)

```js
{
  emit(eventTitle, data) {
    // ...
  },
  on(eventTitle, callback) {
    // ...
  },
  removeListener(eventTitle, callback) {
    // ...
  },
}
```

### List of events emitted by app-manager

* hc-halted
* hc-error
* hc-warning
* hc-beforeunload
* hc-popstate
* hc-replacestate
* hc-pushstate
* hc-statechange
* hc-initialise

## Options

All properties in the options object are optional.

```js
{
  importTimeout: 4000, // Timeout for loading scripts and finding elements in the DOM. Defaults to 4000
  ssrHaltOnError: false, // Boolean value that determines whether the getSlotsMarkup function should throw on error or call the slot's ssrGetErrorMarkup. Defaults to false.
  parentQuerySelector: '.app', // Query selector that is passed into the getElement function  (below) to find the parent element of your app. If not provided, document.body is used.
  async getRouteName(state) {
    // Function that takes a state object and returns the name of a route derived from that state.
    // Defaults to a function that scans the list of routes passed in config and performs an equality check between the current resource (pathname + query) and each route's path

    const params = await deriveParamsFromResource(state.resource);

    return params.routeName;
  },
  async getAdditionalState(state) {
    // Function that allows you to return an object of arbitrary values that will be passed into the state object

    const params = await deriveParamsFromResource(state.resource);

    return {
      params,
    };
  },
  async getElement(container, querySelector) {
    // Function that takes a parent DOM Element and the query selector for the slot we're trying to find on the page, and should return a DOM Element.
    // Defaults to container.querySelector(querySelector)

    return container.querySelector(querySelector);
  },
  async getLayout(state) {
    // Function that is called when browsing onto an app-manager controlled page without hydrating.
    // Allows you to set the default static DOM into which the app will be rendered.
    // Useful when nesting app-manager instances.

    return /* @html */`<div class="app"></div>`;
  }.
}
```
