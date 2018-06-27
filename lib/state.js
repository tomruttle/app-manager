// @flow

import AppManagerError from './utils/app-manager-error';

import type {
  RoutesMapType,
  StateType,
  RouteType,
  GetRouteNameType,
  GetAdditionalStateType,
  AnyStateType,
} from './index';

import { levels } from './constants';

export type UpdateStateType = (parentState: AnyStateType, currentRoute?: ?RouteType) => Promise<StateType>;

const errData = {
  source: 'update_state',
  fragment: null,
  slot: null,
};

export default function initUpdateState(routes: RoutesMapType, getRouteName: GetRouteNameType, getAdditionalState?: GetAdditionalStateType): UpdateStateType {
  if (typeof getRouteName !== 'function') {
    throw new AppManagerError('You must provide a way to derive the route name from the current resource.', {
      ...errData,
      level: levels.ERROR,
      code: 'invalid_options',
      recoverable: false,
    });
  }

  return async function updateState(parentState, currentRoute) {
    let routeName = null;

    try {
      routeName = await getRouteName(parentState);
    } catch (err) {
      throw new AppManagerError(err, {
        ...errData,
        level: levels.ERROR,
        code: 'get_route_name_from_location',
        recoverable: false,
      });
    }

    let state = {
      serverState: parentState.serverState || false,
      rootState: parentState.rootState || false,
      resource: parentState.resource,
      eventTitle: parentState.eventTitle,
      title: typeof parentState.title === 'string' ? parentState.title : null,
      historyState: parentState.historyState || null,
      prevRoute: currentRoute || null,
      route: typeof routeName === 'string' && routeName in routes ? routes[routeName] : null,
    };

    let additionalState = {};

    if (typeof getAdditionalState === 'function') {
      try {
        additionalState = await getAdditionalState(state);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'get_additional_state',
          recoverable: false,
        });
      }
    }

    if ('rootState' in state) {
      const { rootState, ...stateWithoutRoot } = state;
      state = stateWithoutRoot;
    }

    if ('serverState' in state) {
      const { serverState, ...stateWithoutServer } = state;
      state = stateWithoutServer;
    }

    return {
      ...additionalState,
      ...state,
    };
  };
}
