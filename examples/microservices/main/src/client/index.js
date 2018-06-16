// @flow

import EventEmitter from 'eventemitter3';

import appManager from '../../../../../dist/app-manager';

import config, { options } from '../common/config';

const events = new EventEmitter();

appManager(config, events, options);
