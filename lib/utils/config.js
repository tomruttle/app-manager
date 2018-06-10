// @flow

import { DOM_CHECK_INTERVAL, levels } from '../constants';
import AppManagerError from './app-manager-error';

import type {
  RouteNameType,
  RouteType,
  GetRouteNameFromResourceType,
  GetElementType,
} from '../index';

export function setNames<M: {}>(map: { [key: string]: M }): { [key: string]: M & { name: string } } {
  const errData = {
    source: 'set_names',
    fragment: null,
    slot: null,
  };

  if (typeof map !== 'object') {
    throw new AppManagerError('Invalid config: map is not an object.', {
      ...errData,
      level: levels.ERROR,
      code: 'invalid_map',
      recoverable: false,
    });
  }

  return Object.keys(map).reduce((acc, key) => {
    if (typeof map[key] !== 'object') {
      throw new AppManagerError(`Invalid config for ${key}: not an object.`, {
        ...errData,
        level: levels.ERROR,
        code: 'invalid_map_item',
        recoverable: false,
      });
    }

    return { ...acc, [key]: { ...map[key], name: key } };
  }, {});
}

export function defaultGetRouteNameFromResource(routes: { [routeName: RouteNameType]: RouteType }): GetRouteNameFromResourceType {
  if (typeof routes !== 'object') {
    throw new AppManagerError('Invalid config: routes is not an object.', {
      level: levels.ERROR,
      code: 'invalid_routes',
      recoverable: false,
      source: 'default_get_route_name_from_resource',
      fragment: null,
      slot: null,
    });
  }

  return function getRouteNameFromResource(resource) {
    const [path] = resource.split('?');

    if (!path) {
      return null;
    }

    return Object.keys(routes).find((routeName) => {
      const route = routes[routeName];
      return Array.isArray(route.paths) ? route.paths.indexOf(path) !== -1 : path === route.path;
    });
  };
}

export async function delay(timeoutMs: number): Promise<void> {
  if (typeof timeoutMs !== 'number') {
    throw new AppManagerError('Invalid config: importTimeout is not a number.', {
      level: levels.ERROR,
      code: 'invalid_timeout',
      recoverable: false,
      source: 'delay',
      fragment: null,
      slot: null,
    });
  }

  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function retry<T>(iteratee: (...Array<mixed>) => ?T, interval: number): Promise<?T> {
  const firstTry = iteratee();

  if (Boolean(firstTry)) {
    return firstTry;
  }

  return new Promise((resolve) => {
    const iterator = setInterval(() => {
      const iterateeReturn = iteratee();

      if (Boolean(iterateeReturn)) {
        resolve(iterateeReturn);
        clearInterval(iterator);
      }
    }, interval);
  });
}

export const defaultGetElement: GetElementType = function defaultGetElement(container, querySelector) {
  if (typeof querySelector !== 'string') {
    throw new AppManagerError('Invalid config: bad querySelector passed to getElement,', {
      level: levels.ERROR,
      code: 'invalid_query_selector',
      recoverable: false,
      source: 'get_element',
      fragment: null,
      slot: null,
    });
  }

  return retry(
    () => container.querySelector(querySelector),
    DOM_CHECK_INTERVAL,
  );
};
