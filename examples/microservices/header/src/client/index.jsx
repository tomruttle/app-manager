// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type, StateType } from '../../../../../lib/index';

import HeaderApp from '../common/app';

class HeaderScript implements ScriptVersion5Type {
  _activeAppCallback: ?(appName: string) => void = null;
  _statusCallback: ?(status: string) => void = null;

  version = 5;

  _getApp = (app) => (
    <HeaderApp {...app}>
      {(activeAppCallback, statusCallback) => {
        this._activeAppCallback = activeAppCallback;
        this._statusCallback = statusCallback;
      }}
    </HeaderApp>
  );

  render = async (container: Element, { app }: StateType) => { ReactDOM.render(this._getApp(app), container); };

  hydrate = async (container: Element, { app }: StateType) => { ReactDOM.hydrate(this._getApp(app), container); };

  onStateChange = async ({ app }: StateType) => {
    if (typeof this._activeAppCallback === 'function') {
      this._activeAppCallback(app.name);
    }
  };

  onUpdateStatus = async ({ status }: StateType) => {
    if (status && typeof this._statusCallback === 'function') {
      this._statusCallback(status);
    }
  };

  unmount = async (container: Element) => ReactDOM.unmountComponentAtNode(container);
}

export default new HeaderScript();
