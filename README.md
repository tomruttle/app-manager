[![Build Status](https://travis-ci.org/tomruttle/app-manager.svg?branch=master)](https://travis-ci.org/tomruttle/app-manager)

# app-manager

Script for managing the lifecycles of multiple apps on a single page

## Use Case

  * Your app has been built with a microservices architecture.
  * Your front-end code has become sufficiently complex that it warrants splitting up and/or is isomorphically rendered
  * You wish to keep your app 'feeling' like an SPA

## Concepts

### App

Each app must have a unique `appPath` (analogous to an express route) which is used by `app-manager` to determine which app should be displayed at a given time.

An `app` also has an ordered array of `fragments` that should be mounted onto the page and initialised when the user browses to the `appPath`.

### Fragment

A `fragment` is the container for your `script`. It includes:

  * `load`: a function that loads your `script` when called
  * `managed`: a boolean that tells `app-manager` whether to treat this fragment as part of the SPA
  * `slots`: an ordered array of `slots` which tell the `app` where in the DOM to render the `script`

### Slot

A `slot` is a wrapper for a DOM element on a page. You can split your page into as many `slots` as you please. All it requires is a unique element class.

The slot-matching algorithm will try to place as many `scripts` onto a page as it can without clashing (priority dictated by the order of the `fragments` array), and will try to put them into their preferred `slots` (as dictated by the order of the `slots` array).

### Script

A `script` is the entry-point to your code. It needs to conform to a particular interface (as specified below) in order to be managed by `app-manger`, which corresponds to the lifecycle of the page.

## Lifecycle

There are four events that `app-manager` handles. Your `script` must provide a handler for each of them (an identity function is fine.):

  * `hydrate`: Called on first page load. If you are rendering your app isomorphically, you will likely need to grab the initial state of your `scripts` from the DOM.
  * `unmount`: Called when the user browses away from an app, and `scripts` are to be unloaded from the page. Useful to clear up any event listeners, and to reset any mutable state.
    * If you are using React, you will need to call `ReactDOM.unmountComponentAtNode` in order to free up the `slot`.
  * `render`: Called when you browse to the `appPath` of a new app. The page will not refresh when the new set of `fragments` load the required `scripts`, so any initial state much be fetched by xhr.
  * `onStateChange`: Called when the HTML5 history api is used to change the browser state. This event will calculate if the `app` has changed, and if so, decide which `scripts` to unmount and which to mount in their place.

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

## Api

`app-manager` exports a class `AppManager` whose constructor takes two parameters: `config`, an `events` module with the same API as the native node.js module, and (optionally) `options`:

## Example

### config.js

```js
// Where handleClick = (e) => { window.history.pushState({}, null, e.currentTarget.href); };

const example1Markup = /* @html */`<h3>This is Example 1. <a href="/apps/example2" onclick="handleClick(event)">Switch</a></h3>`;

const example2Markup = /* @html */`<h3>This is Example 2. <a href="/apps/example1" onclick="handleClick(event)">Switch</a></h3>`;

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
      managed: true,
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example1Markup; },
        };
      },
      getMarkup() {
        return `<div class="app">${example1Markup}</div>`;
      },
    },

    EXAMPLE2_FRAGMENT: {
      name: 'EXAMPLE2_FRAGMENT',
      slots: ['APP'],
      managed: true,
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example2Markup; },
        };
      },
      getMarkup() {
        return `<div class="app">${example2Markup}</div>`;
      },
    }
  },

  apps: {
    EXAMPLE1_APP: {
      name: 'EXAMPLE1_APP',
      appPath: '/apps/example1',
      fragments: ['EXAMPLE1_FRAGMENT'],
    },

    EXAMPLE2_APP: {
      name: 'EXAMPLE2_APP',
      appPath: '/apps/example2',
      fragments: ['EXAMPLE2_FRAGMENT'],
    }
  }
}
```

### client.js

```js
import AppManager from 'app-manager';

import config from './config';

const appManager = new AppManager(config, new EventEmitter());

appManager.init();
```

### server.js

```js
import AppManagerServer from 'app-manager/es5/server';

import config from './config';

const appManagerServer = new AppManagerServer(config);

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
