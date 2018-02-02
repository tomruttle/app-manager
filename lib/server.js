// @flow

import slotFinder from 'slot-finder';
import qs from 'qs';

import type { ConfigType, AppNameType, QueryType } from './index';

import { evaluatePaths, getAppNameFromPath, evalPathParams } from './utils/path';

export default class AppManagerServer {
  _apps: *;
  _slots: *;
  _fragments: *;
  _evaluatedPaths: *;

  constructor(config: ConfigType) {
    const { apps, slots, fragments } = config;

    this._apps = apps;
    this._slots = slots;
    this._fragments = fragments;
    this._evaluatedPaths = evaluatePaths(this._apps);
  }

  _getAppNameFromPath = (path: string) => {
    const appName = getAppNameFromPath(this._evaluatedPaths, path);

    if (!appName) {
      throw new Error('server.invalid_appPath');
    }

    return appName;
  }

  _getAppFragments = (appName: AppNameType) => {
    const app = this._apps[appName];

    if (!app) {
      throw new Error('server.app_not_found');
    }

    if (!Array.isArray(app.fragments)) {
      throw new Error('server.invalid_app');
    }

    const appFragments = app.fragments
      .map((fragmentName) => this._fragments[fragmentName]);

    const emptySlots = Object.keys(this._slots)
      .reduce((empty, slotName) => Object.assign({}, empty, { [slotName]: null }), {});

    return slotFinder(emptySlots, appFragments);
  };

  _getPathParams = (appName: AppNameType, path: string) => {
    const params = evalPathParams(this._evaluatedPaths[appName], path);

    if (!params) {
      throw new Error('get_path_params.invalid_appPath');
    }

    return params;
  };

  _parseQuery = (query: string | QueryType = {}) => (typeof query === 'object' ? query : qs.parse(query));

  getSlotsMarkup = async (path: string, query?: string | QueryType, ...getMarkupArgs: Array<mixed>): Promise<any> => {
    const currentAppName = this._getAppNameFromPath(path);

    if (!currentAppName) {
      throw new Error('init.no_route');
    }

    const appFragments = this._getAppFragments(currentAppName);

    const state = {
      status: null,
      event: null,
      path,
      params: this._getPathParams(currentAppName, path),
      query: this._parseQuery(query),
      prevApp: null,
      app: this._apps[currentAppName],
    };

    const getMarkupPromises = Object.keys(appFragments).map(async (slotName) => {
      const fragmentName = appFragments[slotName];
      const fragment = this._fragments[fragmentName];

      const markup = fragment && typeof fragment.getMarkup === 'function' ? await fragment.getMarkup(state, ...getMarkupArgs) : '';

      return { slotName, markup };
    });

    const resolvedMarkup = await Promise.all(getMarkupPromises);

    return resolvedMarkup.reduce((acc, { slotName, markup }) => Object.assign({}, acc, { [slotName]: markup }), {});
  }
}
