// @flow

import type { AppNameType, AppType } from '../index';

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
