// @flow

import AppManagerError from './utils/app-manager-error';

import type {
  RoutesMapType,
  StateType,
  RouteType,
  GetRouteNameFromResourceType,
  GetAdditionalStateType,
  RootStateType,
  ServerStateType,
} from './index';

import { levels } from './constants';

export type UpdateStateType = (parentState: ServerStateType | RootStateType | StateType, currentRoute?: ?RouteType) => Promise<?StateType>;

const errData = {
  source: 'update_state',
  fragment: null,
  slot: null,
};

export default function initUpdateState(routes: RoutesMapType, getRouteNameFromResource: GetRouteNameFromResourceType, getAdditionalState?: GetAdditionalStateType): UpdateStateType {
  if (typeof getRouteNameFromResource !== 'function') {
    throw new AppManagerError('You must provide a way to derive the route name from the current resource.', {
      ...errData,
      level: levels.ERROR,
      code: 'invalid_options',
      recoverable: false,
    });
  }

  return async function updateState(parentState, currentRoute) {
    const { resource } = parentState;

    if (!resource) {
      throw new AppManagerError('No resource provided.', {
        ...errData,
        level: levels.ERROR,
        code: 'no_resource_provided',
        recoverable: false,
      });
    }

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

    if (typeof routeName !== 'string' || !routes[routeName]) {
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

    let state = parentState;

    if (state.rootState) {
      const { rootState, ...stateWithoutRoot } = state;
      state = stateWithoutRoot;
    }

    if (state.serverState) {
      const { serverState, ...stateWithoutServer } = state;
      state = stateWithoutServer;
    }

    return {
      ...additionalState,
      ...state,
      prevRoute: currentRoute || null,
      route: routes[routeName],
    };
  };
}
