// @flow

import pathToRegexp from 'path-to-regexp'; // eslint-disable-line import/no-extraneous-dependencies
import qs from 'qs'; // eslint-disable-line import/no-extraneous-dependencies

import type { AppNameType } from '../index';

type ParamsType = { [paramName: string]: string };

export default function getPathHelpers(appPaths: { [appName: AppNameType]: { appPath?: string, appPaths?: Array<string> } }) {
  const pathParams = Object.keys(appPaths || {}).reduce((evaluatedPaths, appName) => {
    const params = pathToRegexp.parse(appPaths[appName])
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);

    return Object.assign({}, evaluatedPaths, { [appName]: params });
  }, {});

  const pathCheckers = Object.keys(appPaths || {}).reduce((evaluatedPaths, appName) => Object.assign({}, evaluatedPaths, {
    [appName]: pathToRegexp(appPaths[appName]),
  }), {});

  function evalPathParams(appName: string, path: string): ParamsType {
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
    getAppNameFromUrl(url: string): ?AppNameType {
      const [path] = url.split('?');
      return Object.keys(pathCheckers).find((appName) => pathCheckers[appName].exec(path));
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
