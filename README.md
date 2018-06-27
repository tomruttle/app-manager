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

An object containing maps of the slots, fragments, and routes that comprise your app. Provided values are illustrative.

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

The state object is passed as a parameter into almost every function within and without app-manager. It contains the useful current state of the browser and the derived state of the application. Provided values are illustrative.

```js
{
  // The pathname and query string currently displayed in the browser
  resource: '/app/some-path?query=value',

  // The current document page title
  title: 'My Page',

  // The current contents of the history state object
  historyState: null,

  // The name of the event (as below) that caused the current action to occur
  eventTitle: 'hc-initialise',

   // The config for the current route (as below)
  route,

  // The config for the route that was previous to the current one. Is null when app is first loaded.
  prevRoute,

  // Any additional state returned from the getAdditionalState function passed into options (as below)
  ...additionalState,
}
```

### Route

A `route` determines which fragments are displayed on which `path`. Provided values are illustrative.

```js
{
  // Path, or paths that uniquely identifies this app. Analogous to a route in express.
  path: '/app/:path',
  paths: ['/app/:path1', '/app/:path2'],

  // Fragment name or ordered array of fragment names to be displayed for that route.
  // If two fragments occupy the same slot, the first will take precedence.
  fragment: 'FRAGMENT_NAME',
  fragments: ['APP_FRAGMENT_NAME', 'HEADER_FRAGMENT_NAME'],
}
```

### Slot

A `slot` is a wrapper for a DOM element on a page. Provided values are illustrative.

```js
{
  // Uniquely returns a single DOM element when passed to document.querySelector.
  querySelector: '.app',

  // Optional function that should return some markup to be displayed in a slot
  // between a fragment being unmounted and a new one being mounted in its place.
  async getLoadingMarkup(state) {
    return /* @html */`<img src="/spinner.gif" alt="Loading ${state.route.name}" />`
  },

  // Optional function that returns a markup string to be displayed in a slot
  // if one of the lifecycle methods for a script throws an error.
  async getErrorMarkup(state) {
    return /* @html */`<p class="error">An error occurred while browsing to ${state.route.name}.`;
  },

  // Optional function that's called if options.ssrHaltOnError is false and ssrGetMarkup
  // for a fragment which is being loaded into this slot throws an error.
  // Should return a markup string.
  async ssrGetErrorMarkup(querySelector, state, ...otherArgs) {
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
  // Slot name or ordered array of slot names.
  // Fragment will be loaded in the first empty slot possible.
  slot: 'SLOT_NAME',
  slots: ['LEFT_SLOT_NAME', 'RIGHT_SLOT_NAME'],

  // Optional function (only needed if using app-manager to manage client-side lifecycle)
  // that fetches the script (as below) for your fragment.
  async loadScript(state) {
    return script;
  },

  // Optional function (only needed if using app-manager for server-side rendering)
  // that fetches the markup needed to render your fragment into a DOM.
  //
  // Should contain any serialised app state you wish to use to hydrate the
  // app on the client, any inline styles, etc.
  //
  // Function is called with the querySelector of the slot into which it is being mounted,
  // state (as above), and any arguments you pass into 'appManagerServer.getSlotsMarkup'.
  async ssrGetMarkup(querySelector, state, ...otherArgs) {
    return markupString;
  },
}
```

### Script

A `script` is the entry-point to your code.

It should contain the lifecycle methods to be called as the user browses around your site. Provided values are illustrative.

```js
{
  // Lets app-manager know which schema to expect from your script
  version: 6,

  // Optional function that will be called if the parent fragment is included
  // on the page on first load
  //
  // If rendering your app isomorphically, you will likely wish to read app state from the DOM here.
  //
  // Function is called with the element into which the fragment is to be mounted and state (as above)
  async hydrate(container, state) {
    const appState = window['__your_app_state__']
    ReactDOM.hydrate(container, <YourApp {...appState} />);
  },

  // Optional function that will be called if the user browses onto an path for which
  // the parent fragment is to be mounted.
  //
  // If your app relies on initial state, you should fetch it here
  //
  // Function is called with the element into which the fragment is to be mounted and state (as above)
  async render(container, state) {
    const props = await getInitialStateFromServer(state.params);

    ReactDOM.render(container, <YourApp {...props} />);
  },

  // Optional function that will be called when an event is fired from the history api,
  // and the fragment is to remain mounted on the page
  //
  // If your fragment has multiple views that should be routed between (for example with path params),
  // this lifecycle method will be where routing is managed.
  //
  // Function is called with state (as above)
  async onStateChange(container, state) {
    await updateAppState(state);
  },

  // Optional function that will be called when the user browses away from an path
  // on which the parent fragment is mounted.
  //
  // Useful to clear up any event listeners, and to reset any mutable state.
  //
  // Function is called with the element into which the fragment is to be mounted and state (as above)
  async unmount(container, state) {
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

All properties in the options object are optional. Provided values are illustrative.

```js
{
  // Timeout for loading scripts and finding elements in the DOM. Defaults to 4000
  importTimeout: 4000,

  // Boolean value that determines whether the getSlotsMarkup function should throw on error
  // or call the slot's ssrGetErrorMarkup. Defaults to false.
  ssrHaltOnError: false,

  // Query selector that is passed into the getElement function  (below) to find
  // the parent element of your app. If not provided, document.body is used.
  parentQuerySelector: '.app',

  // Function that takes a state object and returns the name of a route derived from that state.
  // Defaults to a function that scans the list of routes passed in config and
  // performs an equality check between the current resource (pathname + query) and each route's path
  async getRouteName(state) {
    const params = await deriveParamsFromResource(state.resource);

    return params.routeName;
  },

  // Function that allows you to return an object of arbitrary values that will
  // be passed into the state object
  async getAdditionalState(state) {
    const params = await deriveParamsFromResource(state.resource);

    return {
      params,
    };
  },

  // Function that takes a parent DOM Element and the query selector for the slot we're
  // trying to find on the page, and should return a DOM Element.
  // Defaults to container.querySelector(querySelector)
  async getElement(container, querySelector) {
    return container.querySelector(querySelector);
  },

  // Function that is called when browsing onto an app-manager controlled page without hydrating.
  // Allows you to set the default static DOM into which the app will be rendered.
  // Useful when nesting app-manager instances.
  async getLayout(state) {
    return /* @html */`<div class="app"></div>`;
  }.
}
```
