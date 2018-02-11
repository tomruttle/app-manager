// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  AppType,
  OptionsType,
  AppsMapType,
} from '../index';

import { levels } from '../constants';

export default function initUpdateState(apps: AppsMapType, options: OptionsType) {
  return async function updateState(url: string, prevApp: ?AppType, eventTitle?: mixed): Promise<?StateType> {
    const path = url.split('?')[0];

    const errData = {
      source: 'get_state',
      fragment: null,
      slot: null,
      path,
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
      path,
      prevApp,
      app: apps[appName],
    });
  };
}
