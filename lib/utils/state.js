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
  return function updateState(resource: string, prevApp?: ?AppType, eventTitle?: mixed): ?StateType {
    const errData = {
      source: 'get_state',
      fragment: null,
      slot: null,
    };

    let appName = null;

    if (typeof options.getAppNameFromUrl === 'function') {
      try {
        appName = options.getAppNameFromUrl(resource);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
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
        additionalState = options.getAdditionalState(appName, resource);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        }));
      }
    }

    return Object.assign({}, additionalState, {
      event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
      resource,
      prevApp,
      app: apps[appName],
    });
  };
}
