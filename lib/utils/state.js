// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  RoutesMapType,
  BrowserStateType,
  RouteType,
  GetRouteNameFromResourceType,
  GetAdditionalStateType,
} from '../index';

import { levels } from '../constants';

export default function initUpdateState(routes: RoutesMapType, getRouteNameFromResource: GetRouteNameFromResourceType, getAdditionalState?: GetAdditionalStateType) {
  const errData = {
    source: 'update_state',
    fragment: null,
    slot: null,
  };

  if (typeof getRouteNameFromResource !== 'function') {
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
      routeName = await getRouteNameFromResource(resource);
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

    if (typeof getAdditionalState === 'function') {
      try {
        additionalState = await getAdditionalState(routeName, resource);
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
