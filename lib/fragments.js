// @flow

import slotFinder from './utils/slot-finder';

import type {
  RouteNameType,
  FragmentNameType,
  SlotNameType,
  SlotsMapType,
  FragmentsMapType,
  RoutesMapType,
} from './index';

import AppManagerError from './utils/app-manager-error';
import { levels } from './constants';

export type GetPageFragmentsType = (routeName: RouteNameType) => { [slotName: SlotNameType]: ?FragmentNameType };

export default function initGetPageFragments(slots: SlotsMapType, fragments: FragmentsMapType, routes: RoutesMapType): GetPageFragmentsType {
  return function getPageFragments(routeName) {
    const errData = {
      source: 'get_page_fragments',
      fragment: null,
      slot: null,
    };

    const route = routes[routeName];

    if (!route) {
      throw new AppManagerError(`Route ${routeName} is not specified in config.`, {
        ...errData,
        level: levels.ERROR,
        code: 'missing_route',
        recoverable: false,
      });
    }

    let routeFragmentNames = [];
    if (Array.isArray(route.fragments)) {
      routeFragmentNames = route.fragments;
    } else if (typeof route.fragment === 'string') {
      routeFragmentNames = [route.fragment];
    }

    const routeFragments = routeFragmentNames.map((fragmentName) => fragments[fragmentName]);

    const missingFragments = routeFragments.reduce((missing, fragment, index) => (fragment ? missing : missing.concat(routeFragmentNames[index])), []);
    if (missingFragments.length > 0) {
      throw new AppManagerError(`Route ${routeName} tried to mount at least one missing fragment: ${missingFragments.join(', ')}`, {
        ...errData,
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: false,
      });
    }

    const fragmentsWithSlots = routeFragments.map((fragment) => {
      let fragmentSlots = [];
      if (Array.isArray(fragment.slots)) {
        fragmentSlots = fragment.slots;
      } else if (typeof fragment.slot === 'string') {
        fragmentSlots = [fragment.slot];
      }

      return { name: fragment.name, slots: fragmentSlots };
    });

    const emptySlots = fragmentsWithSlots
      .reduce((fragmentSlots, fragment) => fragmentSlots.concat(fragment.slots), [])
      .reduce((empty, slotName) => ({ ...empty, [slotName]: null }), {});

    const missingSlots = Object.keys(emptySlots).reduce((missing, slotName) => (slots[slotName] ? missing : missing.concat(slotName)), []);
    if (missingSlots.length > 0) {
      throw new AppManagerError(`Route ${routeName} tried to mount into at least one missing slot: ${missingSlots.join(', ')}`, {
        ...errData,
        level: levels.ERROR,
        code: 'invalid_slots',
        recoverable: false,
      });
    }

    try {
      return slotFinder(emptySlots, fragmentsWithSlots);
    } catch (err) {
      throw new AppManagerError(err, {
        ...errData,
        level: levels.ERROR,
        code: 'slot_finder',
        recoverable: true,
      });
    }
  };
}
