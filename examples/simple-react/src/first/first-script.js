import React from 'react';
import ReactDOM from 'react-dom';

import FirstApp from './first-app';

const STATUS_CHANGE = 'statuschange';
const SCRIPT_ID = 'FirstScript';

class FirstScript {
  version = 3;

  hydrate = async (container, events, currentApp) => {
    const app = <FirstApp currentApp={currentApp} action='hydrated' />;
    return ReactDOM.render(app, container);
  }

  mount = async (container, events, currentApp) => {
    const app = <FirstApp currentApp={currentApp} action='mounted' />;
    return ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  unmount = async (container) => ReactDOM.unmountComponentAtNode(container);
}

export default new FirstScript();
