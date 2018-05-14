// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  OptionsType,
  RoutesMapType,
  BrowserStateType,
  RouteType,
} from '../index';

import { levels } from '../constants';

export default function initUpdateState(routes: RoutesMapType, options: OptionsType) {
  const errData = {
    source: 'update_state',
    fragment: null,
    slot: null,
  };

  if (typeof options.getRouteNameFromResource !== 'function') {
    throw new AppManagerError('You must provide a way to derive the route name from the current resource.', {
      ...errData,
      level: levels.ERROR,
      code: 'invalid_options',
      recoverable: false,
    });
  }

  return async function updateState(browserState: BrowserStateType, currentRoute?: ?RouteType): Promise<?StateType> {
    const { resource, eventTitle } = browserState;

    let routeName = null;

    try {
      routeName = await options.getRouteNameFromResource(resource);
    } catch (err) {
      throw new AppManagerError(err, {
        ...errData,
        level: levels.ERROR,
        code: 'get_route_name_from_location',
        recoverable: false,
      });
    }

    if (!routeName || !routes[routeName]) {
      return null;
    }

    let additionalState = {};

    if (typeof options.getAdditionalState === 'function') {
      try {
        additionalState = await options.getAdditionalState(routeName, resource);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        });
      }
    }

    return {
      ...additionalState,
      event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
      resource,
      prevRoute: currentRoute || null,
      route: routes[routeName],
    };
  };
}
