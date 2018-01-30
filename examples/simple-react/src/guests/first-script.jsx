// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import FirstApp from '../components/first-app';
import render from '../utils/render';

import type { ScriptVersion4Type } from '../../../../lib/index';

class FirstScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element) => {
    const app = <FirstApp />;
    return render(app, container);
  }

  mount = async (container: Element) => {
    const app = <FirstApp />;
    return render(app, container);
  }

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => {
    ReactDOM.unmountComponentAtNode(container);
  };
}

export default new FirstScript();
