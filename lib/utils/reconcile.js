// @flow

import slotFinder from 'slot-finder';

import type {
  AppNameType,
  FragmentNameType,
  SlotNameType,
  ConfigType,
  StateType,
  PageDiffType,
} from '../index';

import { setNames } from './config';
import AppManagerError from './app-manager-error';
import { levels } from '../constants';

type PageFragmentsType = { [slotName: SlotNameType]: ?FragmentNameType };

export default function initReconcile(config: ConfigType) {
  const apps = setNames(config.apps);
  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);

  function getPageFragments(appName: AppNameType): PageFragmentsType {
    const errData = {
      source: 'get_page_fragments',
      fragment: null,
      slot: null,
    };

    const app = apps[appName];

    let appFragmentNames = [];
    if (Array.isArray(app.fragments)) {
      appFragmentNames = app.fragments;
    } else if (typeof app.fragment === 'string') {
      appFragmentNames = [app.fragment];
    }

    const appFragments = appFragmentNames.map((fragmentName) => fragments[fragmentName]);

    const missingFragments = appFragments.reduce((missing, fragment, index) => (fragment ? missing : missing.concat(appFragmentNames[index])), []);
    if (missingFragments.length > 0) {
      throw new AppManagerError(`App ${appName} tried to mount at least one missing fragment: ${missingFragments.join(', ')}`, Object.assign({}, errData, {
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

    const missingSlots = Object.keys(emptySlots).reduce((missing, slotName) => (slots[slotName] ? missing : missing.concat(slotName)), []);
    if (missingSlots.length > 0) {
      throw new AppManagerError(`App ${appName} tried to mount into at least one missing slot: ${missingSlots.join(', ')}`, Object.assign({}, errData, {
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
  }

  return function reconcile(state: StateType, initialRender: boolean): PageDiffType {
    const errData = {
      slot: null,
      fragment: null,
      source: 'reconcile',
    };

    if (!state || !state.app) {
      throw new AppManagerError('No app set when trying to reconcile page.', Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'no_current_app',
        recoverable: true,
      }));
    }

    const { app, prevApp } = state;

    const newAppFragments = getPageFragments(app.name);

    const newAppSlots = Object.keys(newAppFragments);

    if (initialRender) {
      const mount = newAppSlots
        .filter((slotName) => newAppFragments[slotName])
        .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newAppFragments[slotName] }), {});

      return { mount, update: {}, unmount: {} };
    }

    if (!prevApp) {
      throw new AppManagerError(`No old app set when trying to mount ${app.name}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'no_previous_app',
        recoverable: false,
      }));
    }

    const oldAppFragments = getPageFragments(prevApp.name);
    const oldAppSlots = Object.keys(oldAppFragments);

    const update = oldAppSlots
      .filter((slotName) => {
        const fragmentName = oldAppFragments[slotName];
        return (
          fragmentName
          && newAppSlots.indexOf(slotName) > -1
          && newAppFragments[slotName] === fragmentName
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newAppFragments[slotName] }), {});

    const unmount = oldAppSlots
      .filter((slotName) => {
        const fragmentName = oldAppFragments[slotName];
        return (
          fragmentName
          && (newAppSlots.indexOf(slotName) === -1 || newAppFragments[slotName] !== fragmentName)
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: oldAppFragments[slotName] }), {});

    const mount = newAppSlots
      .filter((slotName) => {
        const fragmentName = newAppFragments[slotName];
        return (
          fragmentName
          && (oldAppSlots.indexOf(slotName) === -1 || oldAppFragments[slotName] !== fragmentName)
        );
      })
      .reduce((diff, slotName) => Object.assign({}, diff, { [slotName]: newAppFragments[slotName] }), {});

    return { unmount, mount, update };
  };
}
