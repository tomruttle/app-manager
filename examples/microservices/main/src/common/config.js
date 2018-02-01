// @flow

import superagent from 'superagent';

const slots = {
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

const fragments = {
  HEADER_FRAGMENT: {
    name: 'HEADER_FRAGMENT',
    slots: [slots.HEADER.name],
    managed: true,
    load: async () => {},
    getMarkup: async () => {
      const res = await superagent('http://localhost:8081/app');
      return res.text;
    },
  },

  GUEST_TEMPLATE_STRING_FRAGMENT: {
    name: 'GUEST_TEMPLATE_STRING_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    load: async () => {},
    getMarkup: async () => {
      const res = await superagent('http://localhost:8084/app');
      return res.text;
    },
  },

  GUEST_REACT_FRAGMENT: {
    name: 'GUEST_REACT_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    load: async () => {},
    getMarkup: async () => {
      const res = await superagent('http://localhost:8083/app');
      return res.text;
    },
  },

  FOOTER_FRAGMENT: {
    name: 'FOOTER_FRAGMENT',
    slots: [slots.FOOTER.name],
    managed: true,
    load: async () => {},
    getMarkup: async () => {
      const res = await superagent('http://localhost:8082/app');
      return res.text;
    },
  },
};

const apps = {
  GUEST_TEMPLATE_STRING_APP: {
    name: 'GUEST_TEMPLATE_STRING_APP',
    appPath: '/apps/guest-template-string',
    fragments: [fragments.GUEST_TEMPLATE_STRING_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },

  GUEST_REACT_APP: {
    name: 'GUEST_REACT_APP',
    appPath: '/apps/guest-react/:colour?',
    fragments: [fragments.GUEST_REACT_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },
};

export default { apps, slots, fragments };
