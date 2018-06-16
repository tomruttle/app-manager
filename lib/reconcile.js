// @flow

import type { RouteNameType, SlotNameType, FragmentNameType } from './index';

import type { GetPageFragmentsType } from './fragments';

type PageMapType = { [slotName: SlotNameType]: FragmentNameType };

export type ReconcileType = (newRouteName: ?RouteNameType, oldRouteName: ?RouteNameType) => {
  unmount: PageMapType,
  mount: PageMapType,
  update: PageMapType,
};

export default function initReconcile(getPageFragments: GetPageFragmentsType): ReconcileType {
  return function reconcile(newRouteName, oldRouteName) {
    let mount = {};
    let update = {};
    let unmount = {};

    const newRouteFragments = typeof newRouteName === 'string' ? getPageFragments(newRouteName) : {};

    const newRouteSlots = Object.keys(newRouteFragments);

    if (typeof oldRouteName === 'string') {
      const oldRouteFragments = getPageFragments(oldRouteName);
      const oldRouteSlots = Object.keys(oldRouteFragments);

      update = oldRouteSlots
        .filter((slotName) => {
          const fragmentName = oldRouteFragments[slotName];
          return (
            typeof fragmentName === 'string'
            && newRouteSlots.indexOf(slotName) > -1
            && newRouteFragments[slotName] === fragmentName
          );
        })
        .reduce((diff, slotName) => ({ ...diff, [slotName]: newRouteFragments[slotName] }), {});

      unmount = oldRouteSlots
        .filter((slotName) => {
          const fragmentName = oldRouteFragments[slotName];
          return (
            typeof fragmentName === 'string'
            && (newRouteSlots.indexOf(slotName) === -1 || newRouteFragments[slotName] !== fragmentName)
          );
        })
        .reduce((diff, slotName) => ({ ...diff, [slotName]: oldRouteFragments[slotName] }), {});

      mount = newRouteSlots
        .filter((slotName) => {
          const fragmentName = newRouteFragments[slotName];
          return (
            typeof fragmentName === 'string'
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
