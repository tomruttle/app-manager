// @flow

import superagent from 'superagent';

import type { StateType } from '../../../../../lib/index';

import { retry, delay } from '../../../../../lib/utils/timers';

const TIMEOUT_CONTENT = '<p>Oh no!</p>';

function loadScriptFromWindow(scriptName: string) {
  return async () => {
    if (!window) {
      throw new Error('load_script.no_window');
    }

    const script = await retry(() => {
      const file = window[scriptName];
      return file && file.default ? file.default : file;
    }, 20);

    if (!script) {
      throw new Error('load_script.no_script');
    }

    return script;
  };
}

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
    loadScript: loadScriptFromWindow('header'),
    getMarkup: async () => {
      const res = await superagent('http://localhost:8081/app');
      const { markup, styles } = res.body;
      return /* @html */`
        ${styles}
        <div class="header-slot">${markup}</div>
      `;
    },
  },

  GUEST_TEMPLATE_STRING_FRAGMENT: {
    name: 'GUEST_TEMPLATE_STRING_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    loadScript: loadScriptFromWindow('guest-template-string'),
    getMarkup: async () => {
      const res = await superagent('http://localhost:8084/app');
      return /* @html */`
        <div class="app-slot">${res.text}</div>
      `;
    },
  },

  GUEST_REACT_FRAGMENT: {
    name: 'GUEST_REACT_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    loadScript: loadScriptFromWindow('guest-react'),
    getMarkup: async ({ params }: StateType) => {
      const res = await superagent(`http://localhost:8083/app${params.colour ? `/${params.colour}` : ''}`);
      const { markup, styles } = res.body;
      return /* @html */`
        ${styles}
        <div class="app-slot">${markup}</div>
      `;
    },
  },

  GUEST_TIMEOUT_FRAGMENT: {
    name: 'GUEST_TIMEOUT_FRAGMENT',
    slots: [slots.MAIN.name],
    managed: true,
    loadScript: async ({ query }: StateType) => {
      const delayMs = query.delay ? Number(query.delay) : undefined;
      await delay(delayMs);
      return {
        version: 5,
        render: (container, _state) => {
          /* eslint-disable no-param-reassign */
          container.innerHTML = TIMEOUT_CONTENT;
        },
      };
    },
    getMarkup: async () => /* @html */`<div class="app-slot">${TIMEOUT_CONTENT}</div>`,
  },

  FOOTER_FRAGMENT: {
    name: 'FOOTER_FRAGMENT',
    slots: [slots.FOOTER.name],
    managed: true,
    loadScript: loadScriptFromWindow('footer'),
    getMarkup: async () => {
      const res = await superagent('http://localhost:8082/app');
      const { markup, styles } = res.body;
      return /* @html */`
        ${styles}
        <div class="footer-slot">${markup}</div>
      `;
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

  GUEST_TIMEOUT_APP: {
    name: 'GUEST_TIMEOUT_APP',
    appPath: '/apps/guest-timeout',
    fragments: [fragments.GUEST_TIMEOUT_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },
};

export default { apps, slots, fragments };
