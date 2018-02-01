// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type } from '../../../../../lib/index';

import GuestReact from '../common/app';

let updateColour;

const secondScript: ScriptVersion5Type = {
  version: 5,

  _getApp(params) {
    return (
      <GuestReact colour={params.colour}>
        {(updateColourCallback) => {
          updateColour = updateColourCallback;
        }}
      </GuestReact>
    );
  },

  render(container, { params }) { ReactDOM.render(this._getApp(params), container); },

  hydrate(container, { params }) { ReactDOM.hydrate(this._getApp(params), container); },

  onStateChange({ params }) {
    if (typeof updateColour === 'function') {
      updateColour(params.colour);
    }
  },

  unmount: async (container, _state) => ReactDOM.unmountComponentAtNode(container),
};

export default secondScript;
