// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import SecondApp from './second-app';

import type { ScriptVersion4Type, AppType, EventTitleType } from '../../../../lib/index'

const STATUS_CHANGE = 'statuschange';
const SCRIPT_ID = 'SecondScript';

class SecondScript implements ScriptVersion4Type {
  version = 4;

  hydrate = async (container: Element, currentApp: AppType) => {
    const app = <SecondApp currentApp={currentApp} action='hydrated' />;
    return ReactDOM.render(app, container);
  }

  mount = async (container: Element, eventTitle: EventTitleType, currentApp: AppType) => {
    const app = <SecondApp currentApp={currentApp} action='mounted' />;
    return ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  onUpdateStatus = async () => {};

  unmount = async (container: Element) => { await ReactDOM.unmountComponentAtNode(container); };
}

export default new SecondScript();
