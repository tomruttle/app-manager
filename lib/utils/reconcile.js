// @flow

import slotFinder from 'slot-finder';

import type {
  RouteNameType,
  FragmentNameType,
  SlotNameType,
  ConfigType,
  PageDiffType,
} from '../index';

import { setNames } from './config';
import AppManagerError from './app-manager-error';
import { levels } from '../constants';

type PageFragmentsType = { [slotName: SlotNameType]: ?FragmentNameType };

export default function initReconcile(config: ConfigType) {
  const routes = setNames(config.routes);
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);

  function getPageFragments(routeName: RouteNameType): PageFragmentsType {
    const errData = {
      source: 'get_page_fragments',
      fragment: null,
      slot: null,
    };

    const route = routes[routeName];

    if (!route) {
      throw new AppManagerError(`Route ${routeName} is not specified in config.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_route',
        recoverable: false,
      }));
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
      throw new AppManagerError(`Route ${routeName} tried to mount at least one missing fragment: ${missingFragments.join(', ')}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: false,
      }));
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
      .reduce((empty, slotName) => Object.assign(empty, { [slotName]: null }), {});

    const missingSlots = Object.keys(emptySlots).reduce((missing, slotName) => (slots[slotName] ? missing : missing.concat(slotName)), []);
    if (missingSlots.length > 0) {
      throw new AppManagerError(`Route ${routeName} tried to mount into at least one missing slot: ${missingSlots.join(', ')}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'invalid_slots',
        recoverable: false,
      }));
    }

    let pageFragments;

    try {
      pageFragments = slotFinder(emptySlots, fragmentsWithSlots);
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'slot_finder',
        recoverable: true,
      }));
    }

    if (!pageFragments || typeof pageFragments !== 'object') {
      throw new AppManagerError(`SlotFinder returned invalid fragments for route ${routeName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'get_fragments',
        recoverable: true,
      }));
    }

    return pageFragments;
  }

  return function reconcile(newRouteName: ?RouteNameType, oldRouteName: ?RouteNameType): PageDiffType {
    const errData = {
      slot: null,
      fragment: null,
      source: 'reconcile',
    };

    if (!newRouteName) {
      throw new AppManagerError('No route set when trying to reconcile page.', Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'no_current_route',
        recoverable: true,
      }));
    }

    const newRouteFragments = getPageFragments(newRouteName);

    const newRouteSlots = Object.keys(newRouteFragments);

    if (!oldRouteName) {
      const mount = newRouteSlots
        .filter((slotName) => newRouteFragments[slotName])
        .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newRouteFragments[slotName] }), {});

      return { mount, update: {}, unmount: {} };
    }

    const oldRouteFragments = getPageFragments(oldRouteName);
    const oldRouteSlots = Object.keys(oldRouteFragments);

    const update = oldRouteSlots
      .filter((slotName) => {
        const fragmentName = oldRouteFragments[slotName];
        return (
          fragmentName
          && newRouteSlots.indexOf(slotName) > -1
          && newRouteFragments[slotName] === fragmentName
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newRouteFragments[slotName] }), {});

    const unmount = oldRouteSlots
      .filter((slotName) => {
        const fragmentName = oldRouteFragments[slotName];
        return (
          fragmentName
          && (newRouteSlots.indexOf(slotName) === -1 || newRouteFragments[slotName] !== fragmentName)
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: oldRouteFragments[slotName] }), {});

    const mount = newRouteSlots
      .filter((slotName) => {
        const fragmentName = newRouteFragments[slotName];
        return (
          fragmentName
          && (oldRouteSlots.indexOf(slotName) === -1 || oldRouteFragments[slotName] !== fragmentName)
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newRouteFragments[slotName] }), {});

    return { unmount, mount, update };
  };
}
