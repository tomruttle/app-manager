// @flow

import type { ConfigType, OverrideOptionsType, SlotNameType } from './index';

import AppManagerError from './utils/app-manager-error';
import { setNames, defaultGetAppNameFromUrl } from './utils/config';
import { levels } from './constants';
import initReconcile from './utils/reconcile';
import initGetState from './utils/get-state';

export default function appManager(config: ConfigType, overrideOptions?: OverrideOptionsType) {
  const apps = setNames(config.apps);
  const fragments = setNames(config.fragments);

  const defaultOptions = {
    getAppNameFromUrl: defaultGetAppNameFromUrl(apps),
  };

  const options = Object.assign({}, defaultOptions, overrideOptions || {});
  const reconcile = initReconcile(config);
  const getState = initGetState(apps, options);

  return {
    getState,

    async getSlotsMarkup(url: string, ...getMarkupArgs: Array<mixed>): Promise<{ [slotName: SlotNameType]: string }> {
      const [path] = url.split('?');

      const errData = {
        source: 'get_slots_markup',
        fragment: null,
        slot: null,
        path,
      };

      const state = await getState(url);

      if (!state) {
        throw new AppManagerError('Could not find a route to match path', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'invalid_route',
          recoverable: false,
          app: null,
        }));
      }

      const { mount } = reconcile(state, true);

      const getMarkupPromises = () => Object.keys(mount).map(async (slotName) => {
        let markup = '';

        const fragmentName = mount[slotName];

        if (fragmentName) {
          const fragment = fragments[fragmentName];

          if (typeof fragment.getMarkup === 'function') {
            markup = await fragment.getMarkup(state, ...getMarkupArgs);
          }
        }

        return { slotName, markup };
      });

      let resolvedMarkup;

      try {
        resolvedMarkup = await Promise.all(getMarkupPromises());
      } catch (err) {
        throw new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'get_markup',
          recoverable: false,
          app: state.app.name,
        }));
      }

      return resolvedMarkup.reduce((acc, slotMarkup) => (slotMarkup ? Object.assign({}, acc, { [slotMarkup.slotName]: slotMarkup.markup }) : acc), {});
    },
  };
}
