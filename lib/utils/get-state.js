// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  OptionsType,
  AppsMapType,
  AppType,
} from '../index';

import type Window from './window-stub';

import { levels } from '../constants';

export default function initGetState(w: Window, options: OptionsType, apps: AppsMapType) {
  return async function getState(prevApp: ?AppType, eventTitle?: mixed): Promise<?StateType> {
    const { pathname, search } = w.location;

    const url = `${pathname}${search}`;

    const errData = {
      source: 'set_state',
      fragment: null,
      slot: null,
      path: pathname,
    };

    let appName = null;

    if (typeof options.getAppNameFromUrl === 'function') {
      try {
        appName = await options.getAppNameFromUrl(url);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          app: appName,
          level: levels.ERROR,
          code: 'get_app_name_from_location',
          recoverable: false,
        }));
      }
    }

    if (!appName) {
      return null;
    }

    let additionalState = {};

    if (typeof options.getAdditionalState === 'function') {
      try {
        additionalState = await options.getAdditionalState(appName, url);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          app: appName,
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        }));
      }
    }

    return Object.assign({}, additionalState, {
      event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
      path: pathname,
      prevApp,
      app: apps[appName],
    });
  };
}
