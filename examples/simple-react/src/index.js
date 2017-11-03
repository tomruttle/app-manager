const React = require('react');
const ReactDOM = require('react-dom');

const { default: AppManager } = require('../../../dist/app-manager');

function getApp(action, history, { name }) {
  return [
    React.createElement('div', { key: 'div' }, `${action} ${name}`),
    React.createElement('button', {
      key: 'button',
      onClick: (e) => {
        e.preventDefault();
        history.pushState({}, null, '/second-app');
      },
    }, 'CHANGE APP'),
  ];
}

class MockApp {
  constructor() {
    this.version = 3;

    this.hydrate = (container, history, currentApp) => ReactDOM.render(getApp('hydrated', history, currentApp), container);

    this.mount = (container, history, currentApp) => ReactDOM.render(getApp('mounted', history, currentApp), container);

    this.onStateChange = () => {};

    this.unmount = (container) => ReactDOM.unmountComponentAtNode(container);
  }
}

const firstScript = new (class FirstScript extends MockApp {})();
const secondScript = new (class SecondScript extends MockApp {})();

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
