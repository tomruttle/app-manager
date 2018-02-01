// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type } from '../../../../../lib/index';

import GuestReact from '../common/app';

const secondScript: ScriptVersion5Type = {
  version: 5,

  render: async (container, { params }) => { ReactDOM.render(<GuestReact colour={params.colour} />, container); },

  unmount: async (container, _state) => ReactDOM.unmountComponentAtNode(container),
};

export default secondScript;
