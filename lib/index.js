// @flow

/* global window */

import 'babel-polyfill';

import History from 'html5-history';

import initAppManager from './app-manager';

export default initAppManager(window, History);
