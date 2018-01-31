// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type } from '../../../../lib/index';

import SecondApp from '../components/second-app';
import render from '../utils/render';

const secondScript: ScriptVersion5Type = {
  version: 5,

  render: async (container, { params }) => render(<SecondApp colour={params.colour} />, container),

  unmount: async (container, _state) => ReactDOM.unmountComponentAtNode(container),
};

export default secondScript;
