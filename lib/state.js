// @flow

import AppManagerError from './utils/app-manager-error';

import type {
  RoutesMapType,
  StateWithAdditionsType,
  RouteType,
  GetRouteNameFromResourceType,
  GetAdditionalStateType,
} from './index';

import { levels } from './constants';

export type UpdateStateType = (parentState: StateWithAdditionsType, currentRoute?: ?RouteType) => Promise<StateWithAdditionsType>;

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
      ...parentState,
      prevRoute: currentRoute || null,
      route: (routeName && routes[routeName]) || null,
    };
  };
}
