// @flow

import pathToRegexp from 'path-to-regexp'; // eslint-disable-line import/no-extraneous-dependencies
import qs from 'qs'; // eslint-disable-line import/no-extraneous-dependencies

import type { RouteNameType } from '../index';

export type ParamsType = { [paramName: string]: string };

export default function getPathHelpers(routesMap: { [routeName: RouteNameType]: { path?: string, paths?: Array<string> } }) {
  function getPaths(routeName) {
    const { path, paths } = routesMap[routeName];

    let routePaths = [];

    if (Array.isArray(paths) && paths.length > 0) {
      routePaths = paths;
    } else if (path) {
      routePaths = [path];
    }

    if (routePaths.length === 0) {
      throw new Error(`Route ${routeName} has no valid paths specified.`);
    }

    return routePaths;
  }

  function parsePath(path) {
    return pathToRegexp.parse(path)
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);
  }

  const pathParams = Object.keys(routesMap || {})
    .reduce((evaluatedPaths, routeName) => Object.assign({}, evaluatedPaths, {
      [routeName]: getPaths(routeName).map(parsePath),
    }), {});

  const pathCheckers = Object.keys(routesMap || {})
    .reduce((evaluatedPaths, routeName) => Object.assign({}, evaluatedPaths, {
      [routeName]: getPaths(routeName).map((path) => pathToRegexp(path)),
    }), {});

  function evalPathParams(routeName: string, path: string): ?ParamsType {
    return pathCheckers[routeName].reduce((thing, checker, index) => {
      if (thing) {
        return thing;
      }

      const match = checker.exec(path);

      if (!match) {
        return thing;
      }

      const params = match
        .filter((token, idx) => idx > 0)
        .reduce((acc, token, idx) => Object.assign({}, acc, { [pathParams[routeName][index][idx]]: token }), {});

      return params;
    }, null);
  }

  return {
    getRouteNameFromResource(resource: string): ?RouteNameType {
      const [path] = resource.split('?');
      return Object.keys(pathCheckers).find((routeName) => pathCheckers[routeName].find((checker) => checker.exec(path)));
    },

    getAdditionalState(routeName: RouteNameType, resource: string): { params: ParamsType, query: ParamsType } {
      const [path, search] = resource.split('?');
      return {
        params: evalPathParams(routeName, path) || {},
        query: qs.parse(search),
      };
    },
  };
}
