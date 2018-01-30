// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import FirstApp from './first-app';

import type { ScriptVersion4Type, AppType, EventTitleType } from '../../../../lib/index';

class FirstScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element, currentApp: AppType) => {
    const app = <FirstApp currentApp={currentApp} action="hydrated" />;
    ReactDOM.render(app, container);
  }

  mount = async (container: Element, eventTitle: EventTitleType, currentApp: AppType) => {
    const app = <FirstApp currentApp={currentApp} action="mounted" />;
    ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => {
    ReactDOM.unmountComponentAtNode(container);
  };
}

export default new FirstScript();
