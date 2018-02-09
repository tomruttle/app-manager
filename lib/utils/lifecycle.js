// @flow

import { delay, retry, getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptVersion3Type,
  ScriptVersion4Type,
  StatusDetailsType,
  ScriptType,
  FragmentNameType,
  SlotNameType,
  SlotsMapType,
  AppsMapType,
  FragmentsMapType,
  OptionsType,
  StateType,
  LifecycleType,
} from '../index';

import type Window from './window-stub';

import { DOM_CHECK_INTERVAL, eventTitles, levels } from '../constants';

export default function initGetLifecycle(w: Window, options: OptionsType, slots: SlotsMapType, apps: AppsMapType, fragments: FragmentsMapType) {
  const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
  }

  async function getSlotElement(state: StateType, slotName: SlotNameType): Promise<?Element> {
    const errData = {
      source: 'get_slot_element',
      fragment: null,
      slot: null,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    const slot = slots[slotName];

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
      throw new AppManagerError(`Element ${querySelector} not found for slot ${slot.name}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: false,
      }));
    }

    return element;
  }

  async function loadScript(state: StateType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<ScriptType> {
    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: slotName,
      app: state ? state.app.name : null,
      path: state ? state.path : null,
    };

    let script;

    const fragment = fragments[fragmentName];

    if (!fragment || typeof fragment.loadScript !== 'function') {
      throw new AppManagerError('Tried to load invalid fragment.', Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'invalid_fragment',
        recoverable: false,
      }));
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
          await script.onUpdateStatus(statusDetails.status, apps[state.app.name]);
        }
      } else if (typeof script.onUpdateStatus === 'function') {
        await script.onUpdateStatus(statusDetails, state);
      }
    } catch (err) {
      // @TODO Should these be ignored?
    }
  }

  async function hydrate(state: StateType, script: ScriptType, fragmentName: FragmentNameType, slotName: SlotNameType): Promise<void> {
    const slotElement = await getSlotElement(state, slotName);

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
    const slotElement = await getSlotElement(state, slotName);

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

    const slotElement = await getSlotElement(state, slotName);

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

  return async function* scriptLifecycle(initialState: StateType, fragmentName: FragmentNameType, slotName: SlotNameType, initialRender: boolean): LifecycleType {
    let state = initialState;

    const loadingStatusDetails = getLoadingStatusDetails();
    const defaultStatusDetails = getDefaultStatusDetails();

    const cachedScript = cachedScripts[fragmentName];

    let script;

    if (cachedScript) {
      script = cachedScript;
    } else {
      script = await loadScript(state, fragmentName, slotName);

      cachedScripts[fragmentName] = script;
    }

    if (!script) {
      return false;
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
  };
}
