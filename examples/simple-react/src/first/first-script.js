// @flow

import type History from 'html5-history';

import React from 'react';
import ReactDOM from 'react-dom';

import FirstApp from './first-app';

const STATUS_CHANGE = 'statuschange';
const SCRIPT_ID = 'FirstScript';

class FirstScript implements GuestAppVersion3Type {
  version = 3;

  hydrate = async (container: HTMLDivElement, history: History, currentApp: GuestPropsType) => {
    const app = <FirstApp history={history} currentApp={currentApp} action='hydrated' />;
    return ReactDOM.render(app, container);
  }

  mount = async (container: HTMLDivElement, history: History, currentApp: GuestPropsType) => {
    const app = <FirstApp history={history} currentApp={currentApp} action='mounted' />;
    return ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  unmount = (container: HTMLDivElement, history: History) => ReactDOM.unmountComponentAtNode(container);
}

export default new FirstScript();
