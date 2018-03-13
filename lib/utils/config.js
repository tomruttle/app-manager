// @flow

import { DOM_CHECK_INTERVAL } from '../constants';

import type { AppNameType, BaseAppType } from '../index';

export function setNames(map: { [key: string]: Object }) {
  return Object.keys(map || {}).reduce((acc, key) => Object.assign({}, acc, {
    [key]: Object.assign({}, map[key], { name: key }),
  }), {});
}

export function defaultGetAppNameFromResource(apps: { [appName: AppNameType]: BaseAppType }) {
  return function getAppNameFromResource(resource: string) {
    const [path] = resource.split('?');
    return Object.keys(apps).find((appName) => {
      const app = apps[appName];
      return Array.isArray(app.appPaths) ? app.appPaths.indexOf(path) !== -1 : path === app.appPath;
    });
  };
}

export async function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function retry<T>(iteratee: (...Array<mixed>) => ?T, interval: number): Promise<?T> {
  const firstTry = iteratee();

  if (firstTry) {
    return firstTry;
  }

  return new Promise((resolve) => {
    const iterator = setInterval(() => {
      const iterateeReturn = iteratee();

      if (iterateeReturn) {
        resolve(iterateeReturn);
        clearInterval(iterator);
      }
    }, interval);
  });
}

export function defaultGetElement(w: { document: { querySelector(querySelector: string): ?Element } }) {
  return function getElement(querySelector: string): Promise<?Element> {
    return retry(
      () => w.document.querySelector(querySelector),
      DOM_CHECK_INTERVAL,
    );
  };
}
