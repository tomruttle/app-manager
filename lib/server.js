// @flow

import type { ConfigType, OptionsType, SlotNameType } from './index';

import AppManagerError from './utils/app-manager-error';
import { setNames, defaultGetAppNameFromUrl } from './utils/config';
import { levels } from './constants';
import initReconcile from './utils/reconcile';

export default function appManager(config: ConfigType, overrideOptions?: OptionsType) {
  const apps = setNames(config.apps);
  const fragments = setNames(config.fragments);

  const defaultOptions = {
    getAppNameFromUrl: defaultGetAppNameFromUrl(apps),
  };

  const options = Object.assign({}, defaultOptions, overrideOptions || {});
  const reconcile = initReconcile(config);

  return {
    async getSlotsMarkup(url: string, ...getMarkupArgs: Array<mixed>): Promise<{ [slotName: SlotNameType]: string }> {
      let currentAppName = null;
      const [path] = url.split('?');
      const errData = {
        source: 'get_slots_markup',
        fragment: null,
        slot: null,
        app: currentAppName,
        path,
      };

      if (typeof options.getAppNameFromUrl === 'function') {
        try {
          currentAppName = await options.getAppNameFromUrl(url);
        } catch (err) {
          throw new AppManagerError(err, Object.assign({}, errData, {
            level: levels.ERROR,
            code: 'get_app_name_from_location',
            recoverable: false,
          }));
        }
      }

      if (!currentAppName) {
        throw new AppManagerError('Could not find a route to match path', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'invalid_route',
          recoverable: false,
        }));
      }

      let additionalState = {};

      if (typeof options.getAdditionalState === 'function') {
        try {
          additionalState = await options.getAdditionalState(currentAppName);
        } catch (err) {
          throw new AppManagerError(`App ${currentAppName} does not have a fragments array`, Object.assign({}, errData, {
            level: levels.ERROR,
            code: 'get_additional_state',
            recoverable: false,
          }));
        }
      }

      const state = Object.assign({}, additionalState, {
        event: null,
        path,
        prevApp: null,
        app: apps[currentAppName],
      });

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
        }));
      }

      return resolvedMarkup.reduce((acc, slotMarkup) => (slotMarkup ? Object.assign({}, acc, { [slotMarkup.slotName]: slotMarkup.markup }) : acc), {});
    },
  };
}
