// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion4Type } from '../../../../lib/index';
import render from '../utils/render';

import FooterApp from '../components/footer-app';

class FooterScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element) => {
    const app = <FooterApp />;
    return render(app, container);
  }

  mount = async (container: Element) => {
    const app = <FooterApp />;
    return render(app, container);
  }

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => {
    ReactDOM.unmountComponentAtNode(container);
  };
}

export default new FooterScript();
