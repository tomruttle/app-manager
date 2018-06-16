// @flow

import type { ConfigType, OptionsType, SlotNameType } from './index';

import AppManagerError from './utils/app-manager-error';
import { setNames, defaultGetRouteName } from './utils/config';
import { levels, eventTitles } from './constants';
import initReconcile from './reconcile';
import initUpdateState from './state';
import initGetPageFragments from './fragments';

export default function appManager(config: ConfigType, options: OptionsType = {}) {
  const slots = setNames(config.slots);
  const routes = setNames(config.routes);
  const fragments = setNames(config.fragments);
  const getPageFragments = initGetPageFragments(slots, fragments, routes);
  const reconcile = initReconcile(getPageFragments);

  const getRouteName = options.getRouteName || defaultGetRouteName(routes);
  const updateState = initUpdateState(routes, getRouteName, options.getAdditionalState);

  function getState(resource: string) {
    return updateState({
      serverState: true,
      eventTitle: eventTitles.INITIALISE,
      resource,
    });
  }

  return {
    getState,

    async getSlotsMarkup(resource: string, ...ssrGetMarkupArgs: Array<mixed>): Promise<{ [slotName: SlotNameType]: string }> {
      const errData = {
        source: 'get_slots_markup',
        fragment: null,
        slot: null,
      };

      const state = await getState(resource);

      if (!state || !state.route) {
        throw new AppManagerError('Could not find a route to match path', {
          ...errData,
          level: levels.ERROR,
          code: 'invalid_route',
          recoverable: false,
        });
      }

      const newRouteName = state.route.name;

      const { mount } = reconcile(newRouteName);

      const markupPromises = Object.keys(mount).map(async (slotName) => {
        const slot = slots[slotName];
        let markup = '';

        try {
          const fragmentName = mount[slotName];

          if (fragmentName) {
            const fragment = fragments[fragmentName];

            if (typeof fragment.ssrGetMarkup === 'function') {
              markup = await fragment.ssrGetMarkup(slot.querySelector, state, ...ssrGetMarkupArgs);
            }
          }
        } catch (err) {
          if (options.ssrHaltOnError === true) {
            throw new AppManagerError(err, {
              ...errData,
              level: levels.ERROR,
              code: 'get_slot_markup',
              recoverable: false,
              slot: slotName,
            });
          }

          if (typeof slot.ssrGetErrorMarkup === 'function') {
            markup = await slot.ssrGetErrorMarkup(slot.querySelector, state, ...ssrGetMarkupArgs);
          }
        }

        return { [slotName]: markup };
      });

      let resolvedMarkup;

      try {
        resolvedMarkup = await Promise.all(markupPromises);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'get_markup',
          recoverable: false,
        });
      }

      return resolvedMarkup.reduce((acc, slotMarkup) => ({ ...acc, ...slotMarkup }), {});
    },
  };
}
