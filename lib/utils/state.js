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
  return async function updateState(browserState: BrowserStateType, currentRoute?: ?RouteType): Promise<?StateType> {
    const errData = {
      source: 'update_state',
      fragment: null,
      slot: null,
    };

    let routeName = null;
    const { resource, eventTitle } = browserState;

    if (typeof options.getRouteNameFromResource === 'function') {
      try {
        routeName = await options.getRouteNameFromResource(resource);
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'get_route_name_from_location',
          recoverable: false,
        }));
      }
    }

    if (!routeName) {
      return null;
    }

    let additionalState = {};

    if (typeof options.getAdditionalState === 'function') {
      try {
        additionalState = await options.getAdditionalState(routeName, resource);
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
      prevRoute: currentRoute || null,
      route: routes[routeName],
    });
  };
}
