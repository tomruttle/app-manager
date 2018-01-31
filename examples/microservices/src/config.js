// @flow

import firstScript from './guests/first-script';
import secondScript from './guests/second-script';
import footerScript from './guests/footer-script';
import headerScript from './guests/header-script';

export const slots = {
  HEADER: {
    name: 'HEADER',
    querySelector: '.header-slot',
  },

  MAIN: {
    name: 'MAIN',
    querySelector: '.app-slot',
  },

  FOOTER: {
    name: 'FOOTER',
    querySelector: '.footer-slot',
  },
};

export const fragments = {
  HEADER_FRAGMENT: {
    name: 'HEADER_FRAGMENT',
    slots: [slots.HEADER.name],
    managed: true,
    load: async () => headerScript,
  },

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

  FOOTER_FRAGMENT: {
    name: 'FOOTER_FRAGMENT',
    slots: [slots.FOOTER.name],
    managed: true,
    load: async () => footerScript,
  },
};

export const apps = {
  FIRST_APP: {
    name: 'FIRST_APP',
    appPath: '/first-app',
    fragments: [fragments.FIRST_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },

  SECOND_APP: {
    name: 'SECOND_APP',
    appPath: '/second-app/:colour?',
    fragments: [fragments.SECOND_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },
};

export default { apps, slots, fragments };
