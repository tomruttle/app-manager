// @flow

import React from 'react';
import ReactDOM from 'react-dom';
import shortId from 'shortid';

import type { ScriptVersion5Type, StateType } from '../../../../lib/index';
import type { EventType } from '../components/footer-app';

import render from '../utils/render';

import FooterApp from '../components/footer-app';

class FooterScript implements ScriptVersion5Type {
  _currentAppName: ?string = null;
  _updateEventsCallback: ?(event: EventType) => void = null;

  version = 5;

  onError = async (errorDetails: string) => {
    const eventId = shortId.generate();

    if (typeof this._updateEventsCallback === 'function') {
      this._updateEventsCallback({
        id: eventId,
        data: errorDetails,
      });
    }
  };

  render = async (container: Element, { app }: StateType) => {
    this._currentAppName = app.name;

    const footerApp = (
      <FooterApp>
        {(updateEventsCallback) => {
          this._updateEventsCallback = updateEventsCallback;
        }}
      </FooterApp>
    );

    return render(footerApp, container);
  }

  onStateChange = async ({ app }: StateType) => {
    const eventId = shortId.generate();

    if (typeof this._updateEventsCallback === 'function') {
      this._updateEventsCallback({
        id: eventId,
        data: `${this._currentAppName ? `${this._currentAppName} UNMOUNTED AND ` : ''}${app.name} MOUNTED`,
      });
    }

    this._currentAppName = app.name;
  };

  unmount = async (container: Element) => ReactDOM.unmountComponentAtNode(container);
}

export default new FooterScript();
