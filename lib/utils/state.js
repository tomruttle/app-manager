// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  OptionsType,
  AppsMapType,
} from '../index';

import { levels } from '../constants';

export default function initUpdateState(apps: AppsMapType, options: OptionsType) {
  return async function updateState(newState, oldState): Promise<?StateType> {
    const errData = {
      source: 'update_state',
      fragment: null,
      slot: null,
    };

    let appName = null;
    const { resource, eventTitle } = newState;

    if (typeof options.getAppNameFromResource === 'function') {
      try {
        appName = await options.getAppNameFromResource(resource);
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
        additionalState = await options.getAdditionalState(appName, resource);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        }));
      }
    }

    let prevApp = null;

    if (oldState) {
      try {
        const prevAppName = await options.getAppNameFromResource(oldState.resource);

        if (prevAppName) {
          prevApp = apps[prevAppName] || null;
        }
      } catch (err) {
        // Throw it away?
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
