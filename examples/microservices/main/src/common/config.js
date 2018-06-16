// @flow

import superagent from 'superagent';
import getPathHelpers from 'am-path-helpers';

import { retry, delay } from '../../../../../lib/utils/config';

const TIMEOUT_CONTENT = '<p>Oh no!</p>';

function loadScriptFromWindow(scriptName: string) {
  return async () => {
    if (!window) {
      throw new Error('load_script.no_window');
    }

    const script = await retry(() => {
      const file = window[scriptName];
      return file && file.default ? file.default : file;
    }, 20, 4000);

    if (!script) {
      throw new Error('load_script.no_script');
    }

    return script;
  };
}

const mainErrorMessage = /* @html */`
  <div>THERE WAS AN ERROR!</div>
`;

const slots = {
  HEADER: {
    name: 'HEADER',
    querySelector: '.header-slot',
  },

  MAIN: {
    name: 'MAIN',
    querySelector: '.app-slot',
    getLoadingMarkup() { return '<div>WAIT HERE!</div>'; },
    getErrorMarkup() { return mainErrorMessage; },
    ssrGetErrorMarkup(querySelector) {
      return /* @html */`
        <div class="${querySelector.slice(1)}">${mainErrorMessage}</div>
      `;
    },
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
    loadScript: loadScriptFromWindow('header'),
    ssrGetMarkup: async (querySelector) => {
      const res = await superagent(`http://localhost:8081/app${querySelector ? `?querySelector=${querySelector}` : ''}`);
      return res.text;
    },
  },

  GUEST_TEMPLATE_STRING_FRAGMENT: {
    name: 'GUEST_TEMPLATE_STRING_FRAGMENT',
    slots: [slots.MAIN.name],
    loadScript: loadScriptFromWindow('guest-template-string'),
    ssrGetMarkup: async (querySelector) => {
      const res = await superagent(`http://localhost:8084/app${querySelector ? `?querySelector=${querySelector}` : ''}`);
      return res.text;
    },
  },

  GUEST_REACT_FRAGMENT: {
    name: 'GUEST_REACT_FRAGMENT',
    slots: [slots.MAIN.name],
    loadScript: loadScriptFromWindow('guest-react'),
    ssrGetMarkup: async (querySelector, { params }: { params: ParamsType }) => {
      const res = await superagent(`http://localhost:8083/app${params.colour ? `/${params.colour}` : ''}${querySelector ? `?querySelector=${querySelector}` : ''}`);
      return res.text;
    },
  },

  GUEST_TIMEOUT_FRAGMENT: {
    name: 'GUEST_TIMEOUT_FRAGMENT',
    slots: [slots.MAIN.name],
    loadScript: async ({ query }: { query: ParamsType }) => {
      const delayMs = query.delay ? Number(query.delay) : null;

      if (delayMs) {
        await delay(delayMs);
      }

      return {
        version: 5,
        render: (container, _state) => {
          /* eslint-disable no-param-reassign */
          container.innerHTML = TIMEOUT_CONTENT;
        },
      };
    },
    ssrGetMarkup: () => /* @html */`<div class="app-slot">${TIMEOUT_CONTENT}</div>`,
  },

  FOOTER_FRAGMENT: {
    name: 'FOOTER_FRAGMENT',
    slots: [slots.FOOTER.name],
    loadScript: loadScriptFromWindow('footer'),
    ssrGetMarkup: async (querySelector) => {
      const res = await superagent(`http://localhost:8082/app${querySelector ? `?querySelector=${querySelector}` : ''}`);
      return res.text;
    },
  },
};

const routes = {
  GUEST_TEMPLATE_STRING_APP: {
    name: 'GUEST_TEMPLATE_STRING_APP',
    path: '/apps/guest-template-string',
    fragments: [fragments.GUEST_TEMPLATE_STRING_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },

  GUEST_REACT_APP: {
    name: 'GUEST_REACT_APP',
    path: '/apps/guest-react/:colour?',
    fragments: [fragments.GUEST_REACT_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },

  GUEST_TIMEOUT_APP: {
    name: 'GUEST_TIMEOUT_APP',
    path: '/apps/guest-timeout',
    fragments: [fragments.GUEST_TIMEOUT_FRAGMENT.name, fragments.HEADER_FRAGMENT.name, fragments.FOOTER_FRAGMENT.name],
  },
};

const pathsMap = Object.keys(routes).reduce((paths, routeName) => {
  const { path } = routes[routeName];
  return Object.assign({}, paths, { [routeName]: { path } });
}, {});

export const options = getPathHelpers(pathsMap);

export default { routes, slots, fragments };
