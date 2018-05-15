// @flow

import type {
  RouteNameType,
  PageDiffType,
} from './index';

import AppManagerError from './utils/app-manager-error';
import { levels } from './constants';

import type { GetPageFragmentsType } from './fragments';

export type ReconcileType = (newRouteName: ?RouteNameType, oldRouteName: ?RouteNameType) => PageDiffType;

export default function initReconcile(getPageFragments: GetPageFragmentsType): ReconcileType {
  return function reconcile(newRouteName, oldRouteName) {
    const errData = {
      slot: null,
      fragment: null,
      source: 'reconcile',
    };

    if (!newRouteName) {
      throw new AppManagerError('No route set when trying to reconcile page.', {
        ...errData,
        level: levels.ERROR,
        code: 'no_current_route',
        recoverable: true,
      });
    }

    const newRouteFragments = getPageFragments(newRouteName);

    const newRouteSlots = Object.keys(newRouteFragments);

    let mount = {};
    let update = {};
    let unmount = {};

    if (oldRouteName) {
      const oldRouteFragments = getPageFragments(oldRouteName);
      const oldRouteSlots = Object.keys(oldRouteFragments);

      update = oldRouteSlots
        .filter((slotName) => {
          const fragmentName = oldRouteFragments[slotName];
          return (
            fragmentName
            && newRouteSlots.indexOf(slotName) > -1
            && newRouteFragments[slotName] === fragmentName
          );
        })
        .reduce((diff, slotName) => ({ ...diff, [slotName]: newRouteFragments[slotName] }), {});

      unmount = oldRouteSlots
        .filter((slotName) => {
          const fragmentName = oldRouteFragments[slotName];
          return (
            fragmentName
            && (newRouteSlots.indexOf(slotName) === -1 || newRouteFragments[slotName] !== fragmentName)
          );
        })
        .reduce((diff, slotName) => ({ ...diff, [slotName]: oldRouteFragments[slotName] }), {});

      mount = newRouteSlots
        .filter((slotName) => {
          const fragmentName = newRouteFragments[slotName];
          return (
            fragmentName
            && (oldRouteSlots.indexOf(slotName) === -1 || oldRouteFragments[slotName] !== fragmentName)
          );
        })
        .reduce((diff, slotName) => ({ ...diff, [slotName]: newRouteFragments[slotName] }), {});
    } else {
      mount = newRouteSlots
        .filter((slotName) => newRouteFragments[slotName])
        .reduce((diff, slotName) => ({ ...diff, [slotName]: newRouteFragments[slotName] }), {});
    }

    return { unmount, mount, update };
  };
}
