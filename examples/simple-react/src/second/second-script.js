// @flow

import type History from 'html5-history';

import React from 'react';
import ReactDOM from 'react-dom';

import SecondApp from './second-app';

class SecondScript implements GuestAppVersion3Type {
  version = 3;

  hydrate = async (container: HTMLDivElement, history: History, currentApp: GuestPropsType) => {
    const app = <SecondApp history={history} currentApp={currentApp} action='hydrated' />;
    return ReactDOM.render(app, container);
  }

  mount = async (container: HTMLDivElement, history: History, currentApp: GuestPropsType) => {
    const app = <SecondApp history={history} currentApp={currentApp} action='mounted' />;
    return ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  unmount = (container: HTMLDivElement) => ReactDOM.unmountComponentAtNode(container);
}

export default new SecondScript();
