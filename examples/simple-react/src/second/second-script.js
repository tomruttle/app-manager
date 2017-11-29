// @flow

import React from 'react';
import ReactDOM from 'react-dom';

import type History from 'html5-history';
import type { FragmentAppVersion3Type, FragmentPropsType } from '../../../../es5/index'; 

import SecondApp from './second-app';

const STATUS_CHANGE = 'statuschange';
const SCRIPT_ID = 'SecondScript';

class SecondScript implements FragmentAppVersion3Type {
  version = 3;

  hydrate = async (container: HTMLDivElement, history: History, currentApp: FragmentPropsType) => {
    const app = <SecondApp history={history} currentApp={currentApp} action='hydrated' />;
    return ReactDOM.render(app, container);
  }

  mount = async (container: HTMLDivElement, history: History, currentApp: FragmentPropsType) => {
    const app = <SecondApp history={history} currentApp={currentApp} action='mounted' />;
    return ReactDOM.render(app, container);
  }

  onStateChange = async () => {};

  unmount = (container: HTMLDivElement, history: History) => ReactDOM.unmountComponentAtNode(container);
}

export default new SecondScript();
