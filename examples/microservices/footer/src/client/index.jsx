// @flow

import React from 'react';
import ReactDOM from 'react-dom';
import shortId from 'shortid';

import type { ScriptVersion5Type, StateType } from '../../../../../lib/index';
import type { EventType } from '../common/app';

import FooterApp from '../common/app';

class FooterScript implements ScriptVersion5Type {
  _updateEventsCallback: ?(event: EventType) => void = null;

  version = 6;

  _getApp = (initialEvents?: Array<EventType>) => (
    <FooterApp initialEvents={initialEvents}>
      {(updateEventsCallback) => {
        this._updateEventsCallback = updateEventsCallback;
      }}
    </FooterApp>
  );

  onError = async (errorDetails: string) => {
    const eventId = shortId.generate();

    if (typeof this._updateEventsCallback === 'function') {
      this._updateEventsCallback({
        id: eventId,
        data: errorDetails,
      });
    }
  };

  render = async (container: Element) => { ReactDOM.render(this._getApp(), container); }

  hydrate = async (container: Element) => { ReactDOM.hydrate(this._getApp(), container); }

  onStateChange = async (container, { route, prevRoute }: StateType) => {
    const eventId = shortId.generate();
    const callback = this._updateEventsCallback;

    if (typeof callback === 'function') {
      if (prevRoute && prevRoute.name !== route.name) {
        callback({ id: eventId, data: `${prevRoute.name} UNMOUNTED AND ${route.name} MOUNTED` });
      } else {
        callback({ id: eventId, data: `${route.name} UPDATED` });
      }
    }
  };

  onUpdateStatus = async ({ status, message, source }) => {
    if (status === 'ERROR') {
      this.onError(`ERROR: ${message}${source ? `(${source})` : ''}`);
    }
  }

  unmount = async (container: Element) => ReactDOM.unmountComponentAtNode(container);
}

export default new FooterScript();
