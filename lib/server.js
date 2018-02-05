// @flow

import slotFinder from 'slot-finder';
import qs from 'qs';

import type { ConfigType, QueryType } from './index';

import { evaluatePaths, getAppNameFromPath, evalPathParams } from './utils/path';
import AppManagerError from './utils/app-manager-error';
import { setNames } from './utils/config';

export default class AppManagerServer {
  _apps: *;
  _slots: *;
  _fragments: *;
  _evaluatedPaths: *;

  constructor(config: ConfigType) {
    const { apps, slots, fragments } = config;

    this._apps = setNames(apps);
    this._slots = setNames(slots);
    this._fragments = setNames(fragments);
    this._evaluatedPaths = evaluatePaths(this._apps);
  }

  getSlotsMarkup = async (path: string, query?: string | QueryType, ...getMarkupArgs: Array<mixed>): Promise<{ [slotName: string]: string }> => {
    const source = 'get_slots_markup';

    try {
      const currentAppName = getAppNameFromPath(this._evaluatedPaths, path);

      if (!currentAppName) {
        throw new AppManagerError('Could not find a route to match path', {
          code: 'invalid_route',
        });
      }

      const app = this._apps[currentAppName];

      if (!Array.isArray(app.fragments)) {
        throw new AppManagerError(`App ${currentAppName} does not have a fragments array`, {
          code: 'invalid_app',
          id: currentAppName,
        });
      }

      const appFragments = app.fragments
        .map((fragmentName) => this._fragments[fragmentName]);

      const emptySlots = Object.keys(this._slots)
        .reduce((empty, slotName) => Object.assign({}, empty, { [slotName]: null }), {});

      const pageFragments = slotFinder(emptySlots, appFragments);

      const params = evalPathParams(this._evaluatedPaths[currentAppName], path);

      if (!params) {
        throw new AppManagerError(`Could not get params from path for app ${currentAppName}`, {
          code: 'invalid_appPath',
          id: currentAppName,
        });
      }

      const parsedQuery = typeof query === 'object' ? query : qs.parse(query);

      const state = {
        event: null,
        path,
        params,
        query: parsedQuery,
        prevApp: null,
        app: this._apps[currentAppName],
      };

      const getMarkupPromises = Object.keys(pageFragments).map(async (slotName) => {
        const fragmentName = pageFragments[slotName];
        const fragment = this._fragments[fragmentName];

        const markup = fragment && typeof fragment.getMarkup === 'function' ? await fragment.getMarkup(state, ...getMarkupArgs) : '';

        return { slotName, markup };
      });

      const resolvedMarkup = await Promise.all(getMarkupPromises);

      return resolvedMarkup.reduce((acc, { slotName, markup }) => Object.assign({}, acc, { [slotName]: markup }), {});
    } catch (err) {
      throw new AppManagerError(err, {
        source,
        path,
      });
    }
  }
}
