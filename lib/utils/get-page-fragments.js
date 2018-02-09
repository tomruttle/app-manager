// @flow

import slotFinder from 'slot-finder';

import type {
  AppNameType,
  FragmentNameType,
  SlotNameType,
  ConfigType,
} from '../index';

import { setNames } from './config';
import AppManagerError from './app-manager-error';
import { levels } from '../constants';

type PageFragmentsType = { [slotName: SlotNameType]: ?FragmentNameType }

export default function initGetPageFragments(config: ConfigType) {
  const apps = setNames(config.apps);
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);

  return function getPageFragments(appName: AppNameType, path: ?string): PageFragmentsType {
    const errData = {
      source: 'get_page_fragments',
      fragment: null,
      slot: null,
      app: appName,
      path,
    };

    const app = apps[appName];

    let appFragmentNames = [];
    if (Array.isArray(app.fragments)) {
      appFragmentNames = app.fragments;
    } else if (typeof app.fragment === 'string') {
      appFragmentNames = [app.fragment];
    }

    const appFragments = appFragmentNames.map((fragmentName) => fragments[fragmentName]);

    if (!appFragments.every(Boolean)) {
      throw new AppManagerError(`App ${appName} tried to mount at least one missing fragment.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: false,
      }));
    }

    const fragmentsWithSlots = appFragments.map((fragment) => {
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

    const mountableSlots = Object.keys(emptySlots).map((slotName) => slots[slotName]);

    if (!mountableSlots.every(Boolean)) {
      throw new AppManagerError(`App ${appName} tried to mount into at least one missing slot.`, Object.assign({}, errData, {
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
      throw new AppManagerError(`SlotFinder returned invalid fragments for app ${appName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'get_fragments',
        recoverable: true,
      }));
    }

    return pageFragments;
  };
}
