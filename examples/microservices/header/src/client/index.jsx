// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type, StateType } from '../../../../../lib/index';

import HeaderApp from '../common/app';

class HeaderScript implements ScriptVersion5Type {
  _activeAppCallback: ?(appName: string) => void = null;
  _statusCallback: ?(status: string) => void = null;

  version = 6;

  _getApp = (route) => (
    <HeaderApp {...route}>
      {(activeAppCallback, statusCallback) => {
        this._activeAppCallback = activeAppCallback;
        this._statusCallback = statusCallback;
      }}
    </HeaderApp>
  );

  render = async (container: Element, { route }: StateType) => { ReactDOM.render(this._getApp(route), container); };

  hydrate = async (container: Element, { route }: StateType) => { ReactDOM.hydrate(this._getApp(route), container); };

  onStateChange = async ({ route }: StateType) => {
    if (typeof this._activeAppCallback === 'function') {
      this._activeAppCallback(route.name);
    }
  };

  unmount = async (container: Element) => ReactDOM.unmountComponentAtNode(container);
}

export default new HeaderScript();
