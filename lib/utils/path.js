// @flow

import pathToRegexp from 'path-to-regexp'; // eslint-disable-line import/no-extraneous-dependencies
import qs from 'qs'; // eslint-disable-line import/no-extraneous-dependencies

import type { AppNameType } from '../index';

export type ParamsType = { [paramName: string]: string };

export default function getPathHelpers(appPathsMap: { [appName: AppNameType]: { appPath?: string, appPaths?: Array<string> } }) {
  function getPaths(appName) {
    const { appPath, appPaths } = appPathsMap[appName];

    let paths = [];

    if (Array.isArray(appPaths) && appPaths.length > 0) {
      paths = appPaths;
    } else if (appPath) {
      paths = [appPath];
    }

    if (paths.length === 0) {
      throw new Error(`App ${appName} has no valid appPaths specified.`);
    }

    return paths;
  }

  function parsePath(path) {
    return pathToRegexp.parse(path)
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);
  }

  const pathParams = Object.keys(appPathsMap || {})
    .reduce((evaluatedPaths, appName) => Object.assign({}, evaluatedPaths, {
      [appName]: getPaths(appName).map(parsePath),
    }), {});

  const pathCheckers = Object.keys(appPathsMap || {})
    .reduce((evaluatedPaths, appName) => Object.assign({}, evaluatedPaths, {
      [appName]: getPaths(appName).map((path) => pathToRegexp(path)),
    }), {});

  function evalPathParams(appName: string, path: string): ParamsType {
    const evaldParams = pathCheckers[appName].reduce((thing, checker) => {
      if (thing) {
        return thing;
      }

      const match = checker.exec(path);

      if (!match) {
        return thing;
      }

      const params = match
        .filter((token, idx) => idx > 0)
        .reduce((acc, token, idx) => Object.assign({}, acc, { [pathParams[appName][idx]]: token }), {});

      return params;
    }, null);

    if (!evaldParams) {
      throw new Error('Path does not match app.');
    }

    return evaldParams;
  }

  return {
    getAppNameFromUrl(url: string): ?AppNameType {
      const [path] = url.split('?');
      return Object.keys(pathCheckers).find((appName) => pathCheckers[appName].find((checker) => checker.exec(path)));
    },

    getAdditionalState(appName: AppNameType, url: string): { params: ParamsType, query: ParamsType } {
      const [path, search] = url.split('?');
      return {
        params: evalPathParams(appName, path),
        query: qs.parse(search, { ignoreQueryPrefix: true }),
      };
    },
  };
}
