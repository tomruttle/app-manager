// @flow

import EventEmitter from 'eventemitter3';

import AppManager from '../../../dist/app-manager';

import firstScript from './first/first-script';
import secondScript from './second/second-script';

const slots = {
  MAIN: {
    name: 'MAIN',
    elementClass: 'app-slot',
  },
};

const fragments = {
  FIRST_FRAGMENT: {
    name: 'FIRST_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    load: async () => firstScript,
  },

  SECOND_FRAGMENT: {
    name: 'SECOND_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    load: async () => secondScript,
  },
};

const apps = {
  FIRST_APP: {
    name: 'FIRST_APP',
    appPath: '/first-app',
    fragments: [fragments.FIRST_FRAGMENT.name],
  },

  SECOND_APP: {
    name: 'SECOND_APP',
    appPath: '/second-app',
    fragments: [fragments.SECOND_FRAGMENT.name],
  },
};

const config = {
  apps,
  slots,
  fragments,
};

const appManager = new AppManager(config, new EventEmitter());

appManager.on(AppManager.eventTitles.ERROR, (data) => {
  /* eslint-disable no-console */
  console.error('An error has occurred: ', data);
});

appManager.init();
