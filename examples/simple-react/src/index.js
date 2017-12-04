import ReactDOM from 'react-dom';
import React from 'react';

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
    load: () => Promise.resolve(firstScript),
  },

  SECOND_SCRIPT: {
    name: 'SECOND_SCRIPT',
    slots: [slots.MAIN.name],
    managed: true,
    load: () => Promise.resolve(secondScript),
  },
};

const apps = {
  FIRST_APP: {
    name: 'FIRST_APP',
    appPath: '/',
    scripts: [scripts.FIRST_SCRIPT.name],
  },

  SECOND_APP: {
    name: 'SECOND_APP',
    appPath: '/second-app',
    scripts: [scripts.SECOND_SCRIPT.name],
  },
};

const config = {
  apps,
  slots,
  scripts,
};

const appManager = new AppManager(config);

AppManager.bindEvent(AppManager.events.ERROR, (data) => {
  console.error('An error has occurred: ', data);
});

appManager.init();
