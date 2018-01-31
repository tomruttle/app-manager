// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion5Type, StateType } from '../../../../lib/index';

import render from '../utils/render';
import HeaderApp from '../components/header-app';

class HeaderScript implements ScriptVersion5Type {
  _activeAppCallback: ?(appName: string) => void = null;
  _statusCallback: ?(status: string) => void = null;

  version = 5;

  render = async (container: Element, { currentApp }: StateType) => {
    const app = (
      <HeaderApp {...currentApp}>
        {(activeAppCallback, statusCallback) => {
          this._activeAppCallback = activeAppCallback;
          this._statusCallback = statusCallback;
        }}
      </HeaderApp>
    );

    return render(app, container);
  };

  onStateChange = async ({ currentApp }: StateType) => {
    if (typeof this._activeAppCallback === 'function') {
      this._activeAppCallback(currentApp.name);
    }
  };

  onUpdateStatus = async ({ appStatus }: StateType) => {
    if (appStatus && typeof this._statusCallback === 'function') {
      this._statusCallback(appStatus);
    }
  };

  unmount = async (container: Element) => ReactDOM.unmountComponentAtNode(container);
}

export default new HeaderScript();
