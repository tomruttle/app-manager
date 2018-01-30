// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import FirstApp from '../components/first-app';
import render from '../utils/render';

export default {
  version: 4,

  mount: async (container: Element) => render(<FirstApp />, container),

  unmount: async (container: Element) => { ReactDOM.unmountComponentAtNode(container); },
};
