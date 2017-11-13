// @flow

/* global window */

import History from 'html5-history';

import initAppManager from './app-manager';

export default initAppManager(window, History);
