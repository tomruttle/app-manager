// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import { appManager } from '../../../../../dist/app-manager';

import config from '../common/config';
import GuestReact from '../common/app';

config.fragments.FRAGMENT.loadScript = () => {
  let updateColour;

  return {
    version: 6,

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

    onStateChange(container, { params }) {
      if (typeof updateColour === 'function') {
        updateColour(params.colour);
      }
    },

    unmount: async (container, _state) => ReactDOM.unmountComponentAtNode(container),
  };
};

function getLayout() {
  const { querySelector } = config.slots.APP;

  return /* @html */`
    <div class="${querySelector.slice(1)}"></div>
  `;
}

export default appManager(config, null, { getLayout });
