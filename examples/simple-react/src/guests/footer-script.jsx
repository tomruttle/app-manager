// @flow

import React from 'react';
import ReactDOM from 'react-dom';
import shortId from 'shortid';

import type { ScriptVersion4Type, StatusType, AppType, EventTitleType } from '../../../../lib/index';
import type { EventType } from '../components/footer-app';

import render from '../utils/render';

import FooterApp from '../components/footer-app';

class FooterScript implements ScriptVersion4Type {
  _currentAppName: ?string = null;
  _updateEventsCallback: ?(event: EventType) => void = null;

  version = 4;

  _getApp = () => (
    <FooterApp>
      {(updateEventsCallback) => {
        this._updateEventsCallback = updateEventsCallback;
      }}
    </FooterApp>
  );

  hydrate = async (container: Element, currentApp: AppType) => {
    this._currentAppName = currentApp.name;
    return render(this._getApp(), container);
  }

  mount = async (container: Element, eventTitle: EventTitleType, currentApp: AppType) => {
    this._currentAppName = currentApp.name;
    return render(this._getApp(), container);
  }

  onStateChange = async (eventTitle: EventTitleType, currentApp: AppType) => {
    const eventId = shortId.generate();

    if (typeof this._updateEventsCallback === 'function') {
      this._updateEventsCallback({
        id: eventId,
        data: `${this._currentAppName ? `${this._currentAppName} UNMOUNTED AND ` : ''}${currentApp.name} MOUNTED`,
      });
    }

    this._currentAppName = currentApp.name;
  };

  onUpdateStatus = async (status: StatusType, currentApp: AppType) => {
    const eventId = shortId.generate();

    if (status === 'ERROR' && typeof this._updateEventsCallback === 'function') {
      this._updateEventsCallback({
        id: eventId,
        data: 'ERROR OCCURRED',
      });
    }

    this._currentAppName = currentApp.name;
  };

  unmount = async (container: Element) => {
    ReactDOM.unmountComponentAtNode(container);
  };
}

export default new FooterScript();
