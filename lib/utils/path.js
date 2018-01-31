// @flow

import pathToRegexp from 'path-to-regexp';

import type { AppNameType, AppType } from '../index';

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

export function evaluatePaths(apps: { [appName: AppNameType]: AppType }) {
  return Object.keys(apps || {}).reduce((evaluatedPaths, appName) => {
    const { appPath } = apps[appName];

    if (!appPath || typeof appPath !== 'string') {
      return evaluatedPaths;
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
  return Object.keys(evaluatedPaths).find((appName) => {
    const evaluatedPath = evaluatedPaths[appName];
    return evaluatedPath ? evaluatedPath.checker.exec(path) : false;
  });
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
