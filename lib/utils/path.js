// @flow

import pathToRegexp from 'path-to-regexp';

import type { AppNameType, AppType } from '../index';

import AppManagerError from './app-manager-error';

type PathCheckerType = {
  exec: (path: string) => ?Array<string>,
};

type EvaluatedPathType = {
  name: string,
  path: string,
  params: Array<string>,
  checker: PathCheckerType,
}

type EvaluatedPathsMapType = {
  [appName: AppNameType]: EvaluatedPathType,
};

export function evaluatePaths(apps: { [appName: AppNameType]: AppType }): EvaluatedPathsMapType {
  return Object.keys(apps || {}).reduce((evaluatedPaths, appName) => {
    const { appPath } = apps[appName];

    if (!appPath || typeof appPath !== 'string') {
      throw new AppManagerError(`App ${appName} has an invalid appPath.`, {
        source: 'evaluate_paths',
        code: 'invalid_appPath',
        id: appName,
      });
    }

    const params = pathToRegexp.parse(apps[appName].appPath)
      .filter((key) => typeof key === 'object')
      .map(({ name }) => name);

    return Object.assign({}, evaluatedPaths, {
      [appName]: {
        name: appName,
        path: appPath,
        params,
        checker: pathToRegexp(appPath),
      },
    });
  }, {});
}

export function getAppNameFromPath(evaluatedPaths: EvaluatedPathsMapType, path: string): ?string {
  return Object.keys(evaluatedPaths).find((appName) => evaluatedPaths[appName].checker.exec(path));
}

export function evalPathParams(evaluatedPath: EvaluatedPathType, path: string): ?{ [param: string]: string } {
  const match = evaluatedPath.checker.exec(path);

  if (!match) {
    return null;
  }

  return match
    .filter((token, idx) => idx > 0)
    .reduce((params, token, idx) => Object.assign({}, params, { [evaluatedPath.params[idx]]: token }), {});
}
