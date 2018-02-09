// @flow

import slotFinder from 'slot-finder';

import type {
  AppNameType,
  FragmentNameType,
  SlotNameType,
  AppType,
  FragmentType,
  SlotType,
} from '../index';

import AppManagerError from './app-manager-error';
import { levels } from '../constants';

type PageFragmentsType = { [slotName: SlotNameType]: ?FragmentNameType }

export default function initGetPageFragments(apps: { [appName: AppNameType]: AppType }, fragments: { [fragmentName: FragmentNameType]: FragmentType }, slots: { [slotName: SlotNameType]: SlotType }) {
  return function getPageFragments(appName: AppNameType, path: ?string): PageFragmentsType {
    const errData = {
      source: 'get_page_fragments',
      fragment: null,
      slot: null,
      app: appName,
      path,
    };

    const app = apps[appName];

    if (!Array.isArray(app.fragments)) {
      throw new AppManagerError(`App ${appName} does not have a fragments array`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'invalid_app',
        recoverable: false,
      }));
    }

    const appFragments = app.fragments.map((fragmentName) => fragments[fragmentName]);

    if (!appFragments.every(Boolean)) {
      throw new AppManagerError(`App ${appName} tried to mount at least one missing fragment.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: false,
      }));
    }

    const emptySlots = appFragments
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
      pageFragments = slotFinder(emptySlots, appFragments);
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
