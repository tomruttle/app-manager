// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import SecondApp from '../components/second-app';
import render from '../utils/render';

export default {
  version: 5,

  render: async (container: Element) => render(<SecondApp />, container),

  unmount: async (container: Element) => ReactDOM.unmountComponentAtNode(container),
};
