// @flow

import AppManagerError from './app-manager-error';

import type {
  StateType,
  RoutesMapType,
  BrowserStateType,
  RouteType,
  GetRouteNameFromResourceType,
  GetAdditionalStateType,
  StateWithAdditionsType,
} from '../index';

import { levels } from '../constants';

const state = new WeakMap();

const errData = {
  source: 'update_state',
  fragment: null,
  slot: null,
};

export default class Context {
  routes: RoutesMapType;
  getRouteNameFromResource: GetRouteNameFromResourceType;
  getAdditionalState: ?GetAdditionalStateType;

  constructor(routes: RoutesMapType, getRouteNameFromResource: GetRouteNameFromResourceType, getAdditionalState?: GetAdditionalStateType) {
    if (typeof getRouteNameFromResource !== 'function') {
      throw new AppManagerError('You must provide a way to derive the route name from the current resource.', {
        ...errData,
        level: levels.ERROR,
        code: 'invalid_options',
        recoverable: false,
      });
    }

    this.routes = routes;
    this.getRouteNameFromResource = getRouteNameFromResource;
    this.getAdditionalState = getAdditionalState;
  }

  getState(): StateWithAdditionsType {
    return state.get(this);
  }

  async setState(browserState: BrowserStateType, currentRoute?: ?RouteType): Promise<?StateType> {
    const { resource, eventTitle } = browserState;

    let routeName = null;

    try {
      routeName = await this.getRouteNameFromResource(resource);
    } catch (err) {
      throw new AppManagerError(err, {
        ...errData,
        level: levels.ERROR,
        code: 'get_route_name_from_location',
        recoverable: false,
      });
    }

    if (!routeName || !this.routes[routeName]) {
      state.set(this, null);
    }

    let additionalState = {};

    if (typeof this.getAdditionalState === 'function') {
      try {
        additionalState = await this.getAdditionalState(routeName, resource);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        });
      }
    }

    state.set(this, {
      ...additionalState,
      event: eventTitle && typeof eventTitle === 'string' ? eventTitle : null,
      resource,
      prevRoute: currentRoute || null,
      route: this.routes[routeName],
    });
  }
}
