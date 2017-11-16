// @flow

import ReactDOM from 'react-dom';
import React from 'react';

// $FlowFixMe
import AppManager from 'app-manager';

import firstScript from './first/first-script';
import secondScript from './second/second-script';

const slots = {
  MAIN: {
    name: 'MAIN',
    elementClass: 'app-slot',
  },
};

const scripts = {
  FIRST_SCRIPT: {
    name: 'FIRST_SCRIPT',
    slots: [slots.MAIN.name],
    managed: true,
    import() { return Promise.resolve(firstScript); },
  },

  SECOND_SCRIPT: {
    name: 'SECOND_SCRIPT',
    slots: [slots.MAIN.name],
    managed: true,
    import() { return Promise.resolve(secondScript); },
  },
};

const apps = {
  FIRST_APP: {
    name: 'FIRST_APP',
    appPath: '/',
    display: [scripts.FIRST_SCRIPT.name],
  },

  SECOND_APP: {
    name: 'SECOND_APP',
    appPath: '/second-app',
    display: [scripts.SECOND_SCRIPT.name],
  },
};

const config = {
  apps,
  slots,
  scripts,
};

const analytics = {
  namespace: 'simple-react',

  error(data) {
    console.error(data); // eslint-disable-line no-console
  },
};

const appManager = new AppManager(config, analytics);

appManager.init();
