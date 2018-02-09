// @flow

import type AppManagerError from './app-manager-error';
import type { AppNameType, AppType } from '../index';

import { levels, statuses } from '../constants';

export function setNames(map: { [key: string]: Object }) {
  return Object.keys(map || {}).reduce((acc, key) => Object.assign({}, acc, {
    [key]: Object.assign({}, map[key], { name: key }),
  }), {});
}

export function defaultGetAppNameFromUrl(apps: { [appName: AppNameType]: AppType }) {
  return function getAppNameFromUrl(url: string) {
    const [path] = url.split('?');
    return Object.keys(apps).find((appName) => {
      const app = apps[appName];
      return Array.isArray(app.appPaths) ? app.appPaths.indexOf(path) !== -1 : path === app.appPath;
    });
  };
}

export function getDefaultStatusDetails() {
  return {
    level: levels.INFO,
    status: statuses.DEFAULT,
  };
}

export function getLoadingStatusDetails() {
  return {
    level: levels.INFO,
    status: statuses.LOADING,
  };
}

export function getErrorStatusDetails(amError: AppManagerError) {
  return {
    level: amError.level || levels.ERROR,
    status: statuses.ERROR,
    message: amError.message,
  };
}

export async function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function retry<T>(iteratee: (...Array<mixed>) => ?T, interval: number, timeoutMs: number): Promise<?T> {
  const firstTry = iteratee();

  if (firstTry) {
    return firstTry;
  }

  const retries = timeoutMs / interval;
  let iterations = 0;

  return new Promise((resolve) => {
    const iterator = setInterval(() => {
      iterations += 1;

      const iterateeReturn = iteratee();

      if (iterateeReturn || iterations >= retries) {
        resolve(iterateeReturn);
        clearInterval(iterator);
      }
    }, interval);
  });
}
