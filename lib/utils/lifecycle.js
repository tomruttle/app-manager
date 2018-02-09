// @flow

import { setNames, delay, retry, getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptVersion3Type,
  ScriptVersion4Type,
  StatusDetailsType,
  ScriptType,
  FragmentNameType,
  SlotNameType,
  StateType,
  ConfigType,
  LifecycleType,
} from '../index';

import type Window from './window-stub';

import { DOM_CHECK_INTERVAL, eventTitles, levels } from '../constants';

export default function initGetLifecycle(w: Window, config: ConfigType, options: { importTimeout: number }) {
  const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};
  const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

  const fragments = setNames(config.fragments);
  const slots = setNames(config.slots);

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
  }

  async function getSlotElement(state: StateType, slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?Element> {
    const errData = {
      source: 'get_slot_element',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    const slot = slots[slotName];

    if (!slot) {
      throw new AppManagerError(`Slot ${slotName} couls not be found.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'slot_not_found',
        recoverable: false,
      }));
    }

    const { querySelector } = slot;

    if (!querySelector) {
      return null;
    }

    const element = await retry(
      () => selectFromDom(querySelector),
      DOM_CHECK_INTERVAL,
      options.importTimeout,
    );

    if (!element) {
      throw new AppManagerError(`Element ${querySelector} not found for slot ${slotName}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: false,
      }));
    }

    return element;
  }

  async function loadScript(state: StateType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<?ScriptType> {
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

  async function updateStatus(state: StateType, script: ScriptType, statusDetails: StatusDetailsType): Promise<void> {
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

  async function hydrate(state: StateType, script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
    const slotElement = await getSlotElement(state, slotName, fragmentName);

    const errData = {
      source: 'hydrate',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    if (!slotElement) {
      throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: true,
      }));
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

  async function render(state: StateType, script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
    const slotElement = await getSlotElement(state, slotName, fragmentName);

    const errData = {
      source: 'render',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    if (!slotElement) {
      throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: true,
      }));
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

  async function onStateChange(state: StateType, script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
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

  async function unmount(state: StateType, script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
    const errData = {
      source: 'unmount',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    const slotElement = await getSlotElement(state, slotName, fragmentName);

    if (!slotElement) {
      throw new AppManagerError(`Could not get DOM element for fragment ${fragmentName}`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: true,
      }));
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

  async function* getLifecycle(initialState: StateType, fragmentName: FragmentNameType, slotName: SlotNameType, initialRender: boolean): LifecycleType {
    let state = initialState;

    const loadingStatusDetails = getLoadingStatusDetails();
    const defaultStatusDetails = getDefaultStatusDetails();

    const cachedScript = cachedScripts[fragmentName];

    let script;

    if (cachedScript) {
      script = cachedScript;
    } else {
      script = await loadScript(state, fragmentName, slotName);

      if (!script) {
        return false;
      }

      cachedScripts[fragmentName] = script;
    }

    while (state) {
      try {
        state = yield true;
        break;
      } catch (err) {
        /* eslint-disable no-await-in-loop */
        await updateStatus(state, script, getErrorStatusDetails(err));
      }
    }

    await updateStatus(state, script, loadingStatusDetails);

    if (initialRender) {
      await hydrate(state, script, fragmentName, slotName);
    } else {
      await render(state, script, fragmentName, slotName);
    }

    await updateStatus(state, script, defaultStatusDetails);

    while (!state) {
      try {
        state = yield true;
        break;
      } catch (err) {
        /* eslint-disable no-await-in-loop */
        await updateStatus(state, script, getErrorStatusDetails(err));
      }
    }

    while (state) {
      await updateStatus(state, script, loadingStatusDetails);
      await onStateChange(state, script, fragmentName, slotName);
      await updateStatus(state, script, defaultStatusDetails);

      while (true) {
        try {
          state = yield true;
          break;
        } catch (err) {
          /* eslint-disable no-await-in-loop */
          await updateStatus(state, script, getErrorStatusDetails(err));
        }
      }
    }

    state = yield true;

    await updateStatus(state, script, loadingStatusDetails);
    await unmount(state, script, fragmentName, slotName);
    await updateStatus(state, script, defaultStatusDetails);

    while (!state) {
      try {
        state = yield true;
        break;
      } catch (err) {
        /* eslint-disable no-await-in-loop */
        await updateStatus(state, script, getErrorStatusDetails(err));
      }
    }

    return false;
  }

  async function handleErrors(err) {
    const errorPromises = Object.keys(mountedLifecycles).map(async (slotName) => {
      try {
        await mountedLifecycles[slotName].throw(err);
      } catch (_) {
        // @TODO Has already thrown
      }
    });

    return Promise.all(errorPromises);
  }

  async function nextAction(state: StateType, slotName: SlotNameType, fragmentName?: ?FragmentNameType): Promise<boolean> {
    try {
      if (!mountedLifecycles[slotName]) {
        throw new AppManagerError(`Lifecycle not mounted in slot ${slotName}`, {
          recoverable: true,
          level: levels.ERROR,
          code: 'missing_lifecycle',
          source: 'next_action',
          fragment: fragmentName || null,
          slot: slotName,
          app: state ? state.app.name : null,
          path: state ? state.path : null,
        });
      }

      const { value } = await mountedLifecycles[slotName].next(state);
      return value === true;
    } catch (err) {
      await handleErrors(err);
      throw err;
    }
  }

  return {
    async mountSlot(state: StateType, slotName: SlotNameType, fragmentName: ?FragmentNameType, initialRender: boolean): Promise<boolean> {
      const errData = {
        source: 'mount_slot',
        fragment: fragmentName || null,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      if (mountedLifecycles[slotName]) {
        throw new AppManagerError('Overwriting an existing fragment.', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'overwrite_existing',
          recoverable: true,
        }));
      }

      if (fragmentName) {
        mountedLifecycles[slotName] = getLifecycle(state, fragmentName, slotName, initialRender);
      } else {
        delete mountedLifecycles[slotName];
      }

      return nextAction(state, slotName, fragmentName);
    },

    async updateSlot(state: StateType, slotName: SlotNameType, fragmentName: ?FragmentNameType): Promise<boolean> {
      return nextAction(state, slotName, fragmentName);
    },

    async unmountSlot(state: StateType, slotName: SlotNameType): Promise<boolean> {
      const errData = {
        source: 'unmount_slot',
        fragment: null,
        slot: slotName,
        app: state ? state.app.name : null,
        path: state ? state.path : null,
      };

      const done = await nextAction(state, slotName);

      if (!done) {
        throw new AppManagerError('Unmounting a fragment that is not finished.', Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'not_finished',
          recoverable: false,
        }));
      }

      delete mountedLifecycles[slotName];

      return done;
    },
  };
}
