// @flow

import ReactDOM from 'react-dom';
import React from 'react';

// $FlowFixMe
import AppManager from 'app-manager';

import firstScript from './first/first-script';
import secondScript from './second/second-script';

const appSlots = {
  MAIN: {
    name: 'MAIN',
    elementClass: 'app-slot',
  },
};

const guestAppScripts = {
  FIRST_SCRIPT: {
    name: 'FIRST_SCRIPT',
    library: 'first-script',
    slots: [appSlots.MAIN.name],
    managed: true,
    permission: null,
  },

  SECOND_SCRIPT: {
    name: 'SECOND_SCRIPT',
    library: 'second-script',
    slots: [appSlots.MAIN.name],
    managed: true,
    permission: null,
  },
};

const guestApps = {
  FIRST_APP: {
    name: 'FIRST_APP',
    appPath: '/',
    display: [guestAppScripts.FIRST_SCRIPT.name],
  },

  SECOND_APP: {
    name: 'SECOND_APP',
    appPath: '/second-app',
    display: [guestAppScripts.SECOND_SCRIPT.name],
  },
};

const appScriptImports = {
  [guestAppScripts.FIRST_SCRIPT.name]() { return Promise.resolve(firstScript); },
  [guestAppScripts.SECOND_SCRIPT.name]() { return Promise.resolve(secondScript); },
};

const config = {
  appScriptImports,
  guestApps,
  appSlots,
  guestAppScripts,
};

const analytics = {
  namespace: 'simple-react',

  error(data) {
    console.error(data); // eslint-disable-line no-console
  },
};

const appManager = new AppManager(config, analytics);

appManager.init();
