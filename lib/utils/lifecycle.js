// @flow

import { delay, getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptVersion3Type,
  ScriptVersion4Type,
  StatusDetailsType,
  ScriptType,
  FragmentNameType,
  SlotNameType,
  StateType,
  PageDiffType,
  LoadScriptType,
} from '../index';

import { eventTitles, levels } from '../constants';

type FragmentsMapType = { [fragmentName: FragmentNameType]: { loadScript?: LoadScriptType } };
type OptionsType = { importTimeout: number };
type WindowType = { history: Object };
type GetSlotElementType = (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?Element>;
type LifecycleType = AsyncGenerator<void, void, StateType>;

export default function initGetLifecycle(w: WindowType, fragments: FragmentsMapType, getSlotElement: GetSlotElementType, options: OptionsType) {
  const mountedStateChangers: { [slotName: SlotNameType]: LifecycleType } = {};
  const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

  const loadingStatusDetails = getLoadingStatusDetails();
  const defaultStatusDetails = getDefaultStatusDetails();

  async function loadScript(state: StateType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?ScriptType> {
    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    let script;

    const fragment = fragments[fragmentName];

    if (!fragment) {
      throw new AppManagerError(`Fragment ${fragmentName} could not be found`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: true,
      }));
    }

    if (typeof fragment.loadScript !== 'function') {
      return null;
    }

    try {
      script = await Promise.race([fragment.loadScript(state), delay(options.importTimeout)]);
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'load_script',
        recoverable: true,
      }));
    }

    if (!script) {
      throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'time_out',
        recoverable: true,
      }));
    }

    if (!('version' in script)) {
      throw new AppManagerError(`Loaded script for fragment ${fragmentName} does not have a version property.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'invalid_script',
        recoverable: true,
      }));
    }

    return script;
  }

  async function hydrateScript(state: StateType, script: ScriptType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    const slotElement = await getSlotElement(slotName, fragmentName);

    const errData = {
      source: 'hydrate',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    if (!slotElement) {
      return;
    }

    try {
      if (script.version === 3) {
        await (script: ScriptVersion3Type).hydrate(slotElement, w.history, state.app);
      } else if (script.version === 4) {
        if (typeof script.hydrate === 'function') {
          await script.hydrate(slotElement, state.app);
        } else {
          await script.mount(slotElement, eventTitles.HISTORY_REPLACE_STATE, state.app);
        }
      } else if (typeof script.hydrate === 'function') {
        await script.hydrate(slotElement, state);
      } else if (typeof script.render === 'function') {
        await script.render(slotElement, state);
      }
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'hydrate',
        recoverable: true,
      }));
    }
  }

  async function renderScript(state: StateType, script: ScriptType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    const slotElement = await getSlotElement(slotName, fragmentName);

    const errData = {
      source: 'render',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    if (!slotElement) {
      return;
    }

    try {
      if (script.version === 3) {
        await (script: ScriptVersion3Type).mount(slotElement, w.history, state.app);
      } else if (script.version === 4) {
        if (state.event) {
          await (script: ScriptVersion4Type).mount(slotElement, state.event, state.app);
        }
      } else if (typeof script.render === 'function') {
        await script.render(slotElement, state);
      }
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'render',
        recoverable: true,
      }));
    }
  }

  async function updateScript(state: StateType, script: ScriptType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    const errData = {
      source: 'on_state_change',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    try {
      if (script.version === 3) {
        await script.onStateChange(w.history, state.app);
      } else if (script.version === 4) {
        if (typeof script.onStateChange === 'function') {
          if (state.event) {
            await script.onStateChange(state.event, state.app);
          }
        }
      } else if (typeof script.onStateChange === 'function') {
        await script.onStateChange(state);
      }
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'on_state_change',
        recoverable: true,
      }));
    }
  }

  async function unmountScript(state: StateType, script: ScriptType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    const errData = {
      source: 'unmount',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    const slotElement = await getSlotElement(slotName, fragmentName);

    if (!slotElement) {
      return;
    }

    if (!state.prevApp) {
      throw new AppManagerError(`Invalid state at unmount for fragment ${fragmentName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'invalid_state',
        recoverable: true,
      }));
    }

    try {
      if (script.version === 3) {
        await script.unmount(slotElement, w.history, state.prevApp);
      } else if (script.version === 4) {
        if (state.event) {
          await script.unmount(slotElement, state.event, state.prevApp);
        }
      } else if (typeof script.unmount === 'function') {
        await script.unmount(slotElement, state);
      }
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'unmount',
        recoverable: true,
      }));
    }
  }

  async function updateScriptStatus(state: StateType, script: ScriptType, statusDetails: StatusDetailsType): Promise<void> {
    if (script.version === 3) {
      return;
    }

    try {
      if (script.version === 4) {
        if (typeof script.onUpdateStatus === 'function') {
          await script.onUpdateStatus(statusDetails.status, state.app);
        }
      } else if (typeof script.onUpdateStatus === 'function') {
        await script.onUpdateStatus(statusDetails, state);
      }
    } catch (err) {
      // @TODO Should these be ignored?
    }
  }

  async function* stateChanger(initialState: StateType, script: ScriptType, slotName: SlotNameType, fragmentName: FragmentNameType): LifecycleType {
    let state = initialState;

    while (true) {
      /* eslint-disable no-await-in-loop */
      while (true) {
        try {
          state = yield;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await updateScriptStatus(state, script, getErrorStatusDetails(err));
        }
      }

      await updateScriptStatus(state, script, defaultStatusDetails);
      state = yield;

      await updateScriptStatus(state, script, loadingStatusDetails);
      state = yield;

      await updateScript(state, script, slotName, fragmentName);
    }
  }

  async function updateSlot(state: StateType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    const script = cachedScripts[fragmentName];

    let unmount = true;

    try {
      if (mountedStateChangers[slotName]) {
        const { done } = await mountedStateChangers[slotName].next(state);
        unmount = done;

        if (unmount && script) {
          await updateScriptStatus(state, script, defaultStatusDetails);
        }
      }
    } catch (err) {
      if (script) {
        await updateScriptStatus(state, script, getErrorStatusDetails(err));
      }

      throw err;
    } finally {
      if (unmount) {
        if (mountedStateChangers[slotName]) {
          delete mountedStateChangers[slotName];
        }

        if (script) {
          await unmountScript(state, script, slotName, fragmentName);
        }
      }
    }
  }

  async function returnSlot(state: StateType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<void> {
    if (mountedStateChangers[slotName]) {
      await mountedStateChangers[slotName].return();
    }

    await updateSlot(state, slotName, fragmentName);
  }

  async function mountSlot(state: StateType, slotName: SlotNameType, fragmentName: FragmentNameType, initialRender: boolean): Promise<boolean> {
    const { app, path } = state;

    const errData = {
      source: 'mount_slot',
      fragment: fragmentName || null,
      slot: slotName,
      app: app ? app.name : null,
      path: path || null,
    };

    try {
      if (mountedStateChangers[slotName]) {
        throw new AppManagerError('Overwriting an existing fragment.', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'overwrite_existing',
          recoverable: true,
        }));
      }

      const cachedScript = cachedScripts[fragmentName];

      let script;

      if (cachedScript) {
        script = cachedScript;
      } else {
        script = await loadScript(state, slotName, fragmentName);

        if (!script) {
          return false;
        }

        cachedScripts[fragmentName] = script;
      }

      await updateScriptStatus(state, script, loadingStatusDetails);

      try {
        if (initialRender) {
          await hydrateScript(state, script, slotName, fragmentName);
        } else {
          await renderScript(state, script, slotName, fragmentName);
        }

        mountedStateChangers[slotName] = stateChanger(state, script, slotName, fragmentName);
      } catch (err) {
        await updateScriptStatus(state, script, getErrorStatusDetails(err));
        throw err;
      }
    } finally {
      await updateSlot(state, slotName, fragmentName);
    }

    return true;
  }

  async function handleErrors(err) {
    const errorPromises = () => Object.keys(mountedStateChangers).map((errorSlot) => mountedStateChangers[errorSlot].throw(err));
    await Promise.all(errorPromises());
  }

  async function updateAllSlots(state) {
    const updateAllSlotsPromises = () => Object.keys(mountedStateChangers).map((statusSlot) => mountedStateChangers[statusSlot].next(state));
    return Promise.all(updateAllSlotsPromises());
  }

  return async function updatePage(state: StateType, pageDiff: PageDiffType, initialRender: boolean): Promise<boolean> {
    const { unmount, mount, update } = pageDiff;

    const onError = typeof options.onError === 'function' ? options.onError : (_err) => {};

    const updatePromises = () => Object.keys(update).map(async (slotName) => {
      try {
        await updateSlot(state, slotName, update[slotName]);
      } catch (err) {
        await handleErrors(err);
        onError(err);
      }
    });

    const unmountPromises = () => Object.keys(unmount).map(async (slotName) => {
      try {
        await returnSlot(state, slotName, unmount[slotName]);
      } catch (err) {
        await handleErrors(err);
        onError(err);
      }
    });

    const mountPromises = () => Object.keys(mount).map(async (slotName) => {
      let hasScript;

      try {
        hasScript = await mountSlot(state, slotName, mount[slotName], initialRender);
      } catch (err) {
        await handleErrors(err);
        onError(err);
        hasScript = true;
      }

      return hasScript;
    });

    await updateAllSlots(state);
    await Promise.all([...unmountPromises(), ...updatePromises()]);
    const haveScripts = await Promise.all(mountPromises());
    await updateAllSlots(state);

    return haveScripts.every(Boolean);
  };
}