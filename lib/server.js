// @flow

import type { ConfigType, OverrideOptionsType, SlotNameType } from './index';

import AppManagerError from './utils/app-manager-error';
import { setNames, defaultGetRouteNameFromResource } from './utils/config';
import { levels } from './constants';
import initReconcile from './utils/reconcile';
import initUpdateState from './utils/state';

export default function appManager(config: ConfigType, overrideOptions: OverrideOptionsType = {}) {
  const slots = setNames(config.slots);
  const routes = setNames(config.routes);
  const fragments = setNames(config.fragments);
  const reconcile = initReconcile(slots, fragments, routes);

  const getRouteNameFromResource = overrideOptions.getRouteNameFromResource || defaultGetRouteNameFromResource(config.routes);
  const updateState = initUpdateState(routes, getRouteNameFromResource, overrideOptions.getAdditionalState);

  return {
    getState: updateState,

    async getSlotsMarkup(resource: string, ...getMarkupArgs: Array<mixed>): Promise<{ [slotName: SlotNameType]: string }> {
      const errData = {
        source: 'get_slots_markup',
        fragment: null,
        slot: null,
      };

      const state = await updateState({ resource });

      if (!state) {
        throw new AppManagerError('Could not find a route to match path', {
          ...errData,
          level: levels.ERROR,
          code: 'invalid_route',
          recoverable: false,
        });
      }

      const newRouteName = state.route.name;

      const { mount } = reconcile(newRouteName);

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
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'get_markup',
          recoverable: false,
        });
      }

      return resolvedMarkup.reduce((acc, slotMarkup) => ({ ...acc, [slotMarkup.slotName]: slotMarkup.markup }), {});
    },
  };
}
