// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import SecondApp from '../components/second-app';
import render from '../utils/render';

import type { ScriptVersion4Type } from '../../../../lib/index';

class SecondScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element) => {
    const app = <SecondApp />;
    return render(app, container);
  }

  mount = async (container: Element) => {
    const app = <SecondApp />;
    return render(app, container);
  }

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => {
    ReactDOM.unmountComponentAtNode(container);
  };
}

export default new SecondScript();
