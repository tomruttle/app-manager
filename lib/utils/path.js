// @flow

import pathToRegexp from 'path-to-regexp';
import qs from 'qs';

type LocationType = { search: string, pathname: string };

type ParamsType = { [paramName: string]: string };

export default function getPathHelpers(appPaths: { [appName: string]: string }) {
  const pathParams = Object.keys(appPaths || {}).reduce((evaluatedPaths, appName) => {
    const params = pathToRegexp.parse(appPaths[appName])
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);

    return Object.assign({}, evaluatedPaths, { [appName]: params });
  }, {});

  const pathCheckers = Object.keys(appPaths || {}).reduce((evaluatedPaths, appName) => Object.assign({}, evaluatedPaths, {
    [appName]: pathToRegexp(appPaths[appName]),
  }), {});

  function evalPathParams(appName: string, path: string): { [param: string]: string } {
    const match = pathCheckers[appName].exec(path);

    if (!match) {
      throw new Error('Path does not match app.');
    }

    const params = match
      .filter((token, idx) => idx > 0)
      .reduce((acc, token, idx) => Object.assign({}, acc, { [pathParams[appName][idx]]: token }), {});

    return params;
  }

  return {
    getAppNameFromLocation(location: LocationType): ?string {
      return Object.keys(pathCheckers).find((appName) => pathCheckers[appName].exec(location.pathname));
    },

    getAdditionalState(appName: string, location: LocationType): { params: ParamsType, query: ParamsType } {
      return {
        params: evalPathParams(appName, location.pathname),
        query: qs.parse(location.search, { ignoreQueryPrefix: true }),
      };
    },
  };
}
