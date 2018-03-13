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
      name: 'APP',
      querySelector: '.app',
    },
  },

  fragments: {
    EXAMPLE1_FRAGMENT: {
      name: 'EXAMPLE1_FRAGMENT',
      slots: ['APP'],
      loadScript: async (state) => fetchScriptForExample1(state),
      getMarkup: async (state) => fetchMarkupForExample1(state),
    },

    EXAMPLE2_FRAGMENT: {
      name: 'EXAMPLE2_FRAGMENT',
      slots: ['APP'],
      loadScript: async (state) => fetchScriptForExample2(state),
      getMarkup: async (state) => fetchMarkupForExample2(state),
    }
  },

  routes: {
    EXAMPLE1_APP: {
      name: 'EXAMPLE1_APP',
      path: '/apps/example1',
      fragments: ['EXAMPLE1_FRAGMENT'],
    },

    EXAMPLE2_APP: {
      name: 'EXAMPLE2_APP',
      path: '/apps/example2',
      fragments: ['EXAMPLE2_FRAGMENT'],
    }
  }
}
```

### client.js

```js
import AppManager from 'app-manager';

import config from './config';

// ...

const appManager = new AppManager(config, eventEmitter);

appManager.init();
```

### server.js

```js
import AppManagerServer from 'app-manager/server';

import config from './config';

const appManagerServer = new AppManagerServer(config);

// ...

app.get('/apps/*', async (req, res, next) => {
  try {
    const renderedMarkup = await appManagerServer.getSlotsMarkup(req.originalUrl);

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

`app-manager` exports a class `AppManager` whose constructor takes two parameters: `config`, an `events` module with the same API as the native node.js module, and (optionally) `options`:

## Concepts

### App

An `app` determines which fragments are displayed on which `paths`.

```js
{
  name: 'APP_NAME', // Uniquely identifies the app. Must match the app's key on the config map.
  path: '/app/:path', // Path that uniquely identifies this app. Analogous to a route in express.
  fragments: ['FRAGMENT_NAME'], // Ordered array of fragment names. If two fragments occupy the same slot, the first will take precedence.
}
```

### Fragment

A `fragment` is the container for your `script`.

```js
{
  name: 'FRAGMENT_NAME', // Uniquely identifies the fragment. Must match the fragment's key on the config map.
  slots: ['SLOT_NAME'], // Ordered array of slot names. Fragment will be loaded in the first empty slot possible.
  loadScript, // As below.
  getMarkup, // Optional. As below.
}

// * Optional function (only needed if using app-manager to manage client-side lifecycle) that fetches the script (as below) for your fragment.

async function loadScript(state) {
  // ...

  return script;
}

// * Optional function (only needed if using app-manager for server-side rendering) that fetches the markup needed to render your fragment into a DOM.
// * Should contain any serialised app state you wish to use to hydrate the app on the client, any inline styles, etc.
// * Function is called with state (as below) and any arguments you pass into the 'appManagerServer.getSlotsMarkup' function.

async function getMarkup(state, ...otherArgs) {
  // ...

  return markupString;
}

```

### Script

A `script` is the entry-point to your code, and will likely be served from a remote app.

It should contain the lifecycle methods to be called as the user browses around your site:

```js
{
  version: 5 // Lets app-manager the schema it expect from your script
  hydrate,
  render,
  onStateChange,
  unmount,
}

// * Optional function that will be called if the parent fragment is included on the page on first load
// * If rendering your app isomorphically, you will likely wish to read app state from the DOM here.
// * Function is called with the element into which the fragment is to be mounted and state (as below)

async function hydrate(container, state) {
  // Example:
  // const appState = window['__yourapp_state__']
  // ReactDOM.hydrate(container, <YourApp {...appState} />);
}

// * Optional function that will be called if the user browses onto an path for which the parent fragment is to be mounted.
// * If your app relies on initial state, you should fetch it here
// * Function is called with the element into which the fragment is to be mounted and state (as below)

async function render(container, state) {
  // Example:
  // const props = await getInitialStateFromServer(state.params);
  // ReactDOM.render(container, <YourApp {...props} />);
}

// * Optional function that will be called when the user browses away from an path on which the parent fragment is mounted.
// * Useful to clear up any event listeners, and to reset any mutable state.
// * Function is called with the element into which the fragment is to be mounted and state (as below)

async function unmount(container, state) {
  // Example:
  // ReactDOM.unmountComponentAtNode(container);
}

// * Optional function that will be called when an event is fired from the history api, and the fragment is to remain mounted on the page
// * If your fragment has multiple views that should be routed between (for example with path params), this lifecycle method will be where routing is managed.
// * Function is called with state (as below)

async function onStateChange(state) {
  // ...
}
```

### Slot

A `slot` is a wrapper for a DOM element on a page.

```js
{
  name: 'APP', // Uniquely identifies the slot. Must match the slot's key on the config map.
  querySelector: '.app', // Uniquely returns a single DOM element when passed to document.querySelector.
},
```

### State

```js
{
  event: 'am-pushstate' // Name of event (as below) that triggered the lifecycle to fire, if there is one.
  path: '/app/path', // Current path as per html5 history.
  params: { pathParam: value }, // Map containing parsed path parameters for the current path.
  query: { queryParam: value }, // Map containing parsed query parameters for the current path.
  prevApp: // The previously mounted app (as above), if there was one.
  app, // The current app (as above).
}

```

### Events

List of events emitted by app-manager:

* am-beforeunload,
* am-popstate,
* am-replacestate,
* am-pushstate,
* am-statechange,
* am-statuschange,
* am-error,
* am-external-link,

## Dependencies

### path-to-regexp

This is the same library Express uses to parse route paths, so if you have used Express you should be familiar with the syntax (`/path/:param(valid|options)/:optional?`). `app-manager` uses it to determine which `app` to display, and to extract url parameters.

[https://github.com/pillarjs/path-to-regexp](https://github.com/pillarjs/path-to-regexp)

### slot-finder

A small script that provides the algorithm to decide which script goes in which slot.

[https://github.com/tomruttle/slot-finder](https://github.com/tomruttle/slot-finder)

### qs

For query string parsing.

[https://www.npmjs.com/package/qs](https://www.npmjs.com/package/qs)

### html5 history API

Native history module. Used to handle client-side routing.

[https://developer.mozilla.org/en-US/docs/Web/API/History](https://developer.mozilla.org/en-US/docs/Web/API/History)
