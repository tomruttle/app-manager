// @flow

import initReconcile from './utils/reconcile';
import initUpdateState from './utils/state';
import initLoadScript from './utils/script';
import AppManagerError from './utils/app-manager-error';
import { setNames, delay } from './utils/config';
import { levels, statuses } from './constants';

import type {
  ConfigType,
  BrowserStateType,
  FragmentNameType,
  SlotNameType,
  StateWithAdditionsType,
  LoadedScriptType,
  FragmentType,
  OnErrorCallbackType,
  OptionsType,
} from './index';

type LifecycleType = AsyncGenerator<true, boolean, boolean>;

export default function appManager(config: ConfigType, options: OptionsType) {
  let state: StateWithAdditionsType;

  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);
  const apps = setNames(config.apps);

  const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};
  const cachedScripts: { [fragmentName: FragmentNameType]: LoadedScriptType } = {};

  async function loadScript(fragment: FragmentType): Promise<?LoadedScriptType> {
    if (cachedScripts[fragment.name]) {
      return cachedScripts[fragment.name];
    }

    const errData = {
      source: 'load_script',
      fragment: fragment.name,
      slot: null,
    };

    try {
      let script = null;

      if (fragment.loadScript) {
        script = await fragment.loadScript(state);
        cachedScripts[fragment.name] = script;
      }

      return script;
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'load_script',
        recoverable: true,
      }));
    }
  }

  const reconcile = initReconcile(config);
  const updateState = initUpdateState(apps, options);
  const getScript = initLoadScript(fragments, loadScript, options);

  const loadingStatusDetails = {
    level: levels.INFO,
    status: statuses.LOADING,
  };

  const defaultStatusDetails = {
    level: levels.INFO,
    status: statuses.DEFAULT,
  };

  function getErrorStatusDetails(amError: AppManagerError) {
    return {
      level: amError.level || levels.ERROR,
      status: statuses.ERROR,
      message: amError.message,
    };
  }

  async function getSlotElement(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?Element> {
    const errData = {
      source: 'get_slot_element',
      fragment: fragmentName,
      slot: slotName,
    };

    const slot = slots[slotName];

    if (!slot) {
      throw new AppManagerError(`Slot ${slotName} could not be found.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'slot_not_found',
        recoverable: false,
      }));
    }

    const { querySelector } = slot;

    if (!querySelector) {
      return null;
    }

    const element = await Promise.race([options.getElement(querySelector), delay(options.importTimeout)]);

    if (!element) {
      throw new AppManagerError(`Element ${querySelector} not found for slot ${slotName}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: false,
      }));
    }

    return element;
  }

  async function* createLifecycle(slotName: SlotNameType, fragmentName: FragmentNameType, initialRender: boolean): LifecycleType {
    const script = await getScript(slotName, fragmentName);

    if (!script) {
      if (!initialRender) {
        const slot = slots[slotName];

        if (slot) {
          const { errorMarkup } = slot;

          if (typeof errorMarkup === 'string') {
            try {
              const errorSlotElement = await getSlotElement(slotName, fragmentName);

              if (errorSlotElement) {
                errorSlotElement.innerHTML = errorMarkup;
              }
            } catch (_) {
              // Ignore these errors.
            }
          }
        }
      }

      return false;
    }

    const errData = {
      source: 'lifecycle',
      fragment: fragmentName,
      slot: slotName,
    };

    async function updateStatus(statusDetails) {
      try {
        if (state) {
          await script.onUpdateStatus(statusDetails, state);
        }
      } catch (_) {
        // Ignore these errors.
      }
    }

    async function getElement() {
      try {
        return await getSlotElement(slotName, fragmentName);
      } catch (err) {
        await updateStatus(getErrorStatusDetails(err));
        throw err;
      }
    }

    async function unmount() {
      const unmountSlotElement = await getElement();

      if (unmountSlotElement) {
        try {
          await script.unmount(unmountSlotElement, state);
        } catch (err) {
          const amError = new AppManagerError(err, Object.assign({}, errData, {
            level: levels.ERROR,
            code: 'unmount',
            recoverable: true,
          }));

          await updateStatus(getErrorStatusDetails(amError));
          throw amError;
        }
      }
    }

    async function handleError(err) {
      try {
        await updateStatus(getErrorStatusDetails(err));
        await unmount();
      } catch (_) {
        // Ignore these errors
      }

      const slot = slots[slotName];

      if (slot) {
        const { errorMarkup } = slot;

        if (typeof errorMarkup === 'string') {
          try {
            const errorSlotElement = await getElement();

            if (errorSlotElement) {
              errorSlotElement.innerHTML = errorMarkup;
            }
          } catch (_) {
            // Ignore these errors.
          }
        }
      }
    }

    await updateStatus(loadingStatusDetails);

    const mountSlotElement = await getElement();

    if (mountSlotElement) {
      try {
        if (initialRender) {
          await script.hydrate(mountSlotElement, state);
        } else {
          await script.render(mountSlotElement, state);
        }
      } catch (err) {
        const amError = new AppManagerError(err, Object.assign({}, errData, {
          level: levels.ERROR,
          code: 'mount',
          recoverable: true,
        }));

        await handleError(err);
        throw amError;
      }
    }

    let stop;

    while (!stop) {
      /* eslint-disable no-await-in-loop */

      while (true) {
        try {
          stop = yield true;
          break;
        } catch (err) {
          await updateStatus(getErrorStatusDetails(err));
        }
      }

      await updateStatus(defaultStatusDetails);

      stop = yield true;

      await updateStatus(loadingStatusDetails);

      stop = yield true;

      if (!stop) {
        try {
          await script.onStateChange(state);
        } catch (err) {
          const amError = new AppManagerError(err, Object.assign({}, errData, {
            level: levels.ERROR,
            code: 'on_state_change',
            recoverable: true,
          }));

          await handleError(err);
          throw amError;
        }
      }
    }

    await unmount();

    const slot = slots[slotName];

    if (slot) {
      const { loadingMarkup } = slot;

      if (typeof loadingMarkup === 'string') {
        try {
          const errorSlotElement = await getElement();

          if (errorSlotElement) {
            errorSlotElement.innerHTML = loadingMarkup;
          }
        } catch (_) {
          // Ignore these errors.
        }
      }
    }

    await updateStatus(defaultStatusDetails);

    return true;
  }

  async function handleLifecycleError(slotName: SlotNameType, err: Error): Promise<void> {
    if (mountedLifecycles[slotName]) {
      delete mountedLifecycles[slotName];
    }

    const errorPromises = () => Object.keys(mountedLifecycles).map((errorSlot) => mountedLifecycles[errorSlot].throw(err));
    await Promise.all(errorPromises());
  }

  async function updateAllSlots(): Promise<void> {
    const updateAllSlotsPromises = () => Object.keys(mountedLifecycles).map((statusSlot) => mountedLifecycles[statusSlot].next(false));
    await Promise.all(updateAllSlotsPromises());
  }

  async function stateChanger(browserState: BrowserStateType, onRecoverableError?: OnErrorCallbackType): Promise<boolean> {
    const currentApp = state ? state.app : null;
    const newState = await updateState(browserState, currentApp);

    if (!newState) {
      return false;
    }

    state = newState;

    const newAppName = state.app.name;
    const oldAppName = state.prevApp ? state.prevApp.name : null;
    const initialRender = !oldAppName;

    const { unmount, mount, update } = reconcile(newAppName, oldAppName);

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    const updatePromises = () => slotsToUpdate.map(async (slotName) => {
      try {
        if (mountedLifecycles[slotName]) {
          const { value } = await mountedLifecycles[slotName].next(false);
          return value;
        }

        return false;
      } catch (err) {
        await handleLifecycleError(slotName, err);

        if (typeof onRecoverableError === 'function') {
          onRecoverableError(err);
        }

        return false;
      }
    });

    const unmountPromises = () => slotsToUnmount.map(async (slotName) => {
      try {
        if (mountedLifecycles[slotName]) {
          const { value } = await mountedLifecycles[slotName].next(true);
          delete mountedLifecycles[slotName];
          return value;
        }

        return false;
      } catch (err) {
        await handleLifecycleError(slotName, err);

        if (typeof onRecoverableError === 'function') {
          onRecoverableError(err);
        }

        return false;
      }
    });

    const mountPromises = () => slotsToMount.map(async (slotName) => {
      const fragmentName = mount[slotName];

      if (mountedLifecycles[slotName]) {
        throw new AppManagerError('Overwriting an existing fragment.', {
          source: 'update_page',
          fragment: fragmentName,
          slot: slotName,
          level: levels.ERROR,
          code: 'overwrite_existing',
          recoverable: true,
        });
      }

      try {
        mountedLifecycles[slotName] = await createLifecycle(slotName, fragmentName, initialRender);
        const { value } = await mountedLifecycles[slotName].next(false);
        return value;
      } catch (err) {
        await handleLifecycleError(slotName, err);

        if (typeof onRecoverableError === 'function') {
          onRecoverableError(err);
        }

        return false;
      }
    });

    await updateAllSlots();
    await Promise.all(updatePromises());
    await Promise.all(unmountPromises());
    const haveScripts = await Promise.all(mountPromises());

    await updateAllSlots();

    return haveScripts.every(Boolean) || initialRender;
  }

  // @TODO Make this function a getter with Object.defineProperty?
  stateChanger.getState = function getState() {
    return state;
  };

  return stateChanger;
}
