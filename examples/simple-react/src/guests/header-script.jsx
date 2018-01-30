// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type { ScriptVersion4Type, AppType, EventTitleType, StatusType } from '../../../../lib/index';

import render from '../utils/render';
import HeaderApp from '../components/header-app';

class HeaderScript implements ScriptVersion4Type {
  _activeAppCallback: ?(appName: string) => void = null;
  _statusCallback: ?(status: string) => void = null;

  version = 4;

  mount = async (container: Element, eventTitle: EventTitleType, currentApp: AppType) => {
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

  onStateChange = async (eventTitle: string, currentApp: AppType) => {
    if (typeof this._activeAppCallback === 'function') {
      this._activeAppCallback(currentApp.name);
    }
  };

  onUpdateStatus = async (status: StatusType) => {
    if (typeof this._statusCallback === 'function') {
      this._statusCallback(status);
    }
  };

  unmount = async (container: Element) => { ReactDOM.unmountComponentAtNode(container); };
}

export default new HeaderScript();
