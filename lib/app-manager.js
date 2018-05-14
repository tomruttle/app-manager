// @flow

import initReconcile from './utils/reconcile';
import initUpdateState from './utils/state';
import AppManagerError from './utils/app-manager-error';
import { setNames, delay } from './utils/config';
import { levels, statuses } from './constants';
import wrapScript from './utils/script';

import type {
  ConfigType,
  BrowserStateType,
  FragmentNameType,
  SlotNameType,
  StateWithAdditionsType,
  ScriptType,
  OnErrorCallbackType,
  OptionsType,
} from './index';

type LifecycleType = AsyncGenerator<true, boolean, boolean>;

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

export default function appManager(config: ConfigType, options: OptionsType) {
  let state: StateWithAdditionsType;

  const slots = setNames(config.slots);
  const fragments = setNames(config.fragments);
  const routes = setNames(config.routes);

  const mountedLifecycles: Map<SlotNameType, LifecycleType> = new Map();
  const cachedScripts: Map<FragmentNameType, ?ScriptType> = new Map();

  async function getFragmentScript(fragmentName: FragmentNameType): Promise<?ScriptType> {
    const cachedScript = cachedScripts.get(fragmentName);

    if (cachedScript) {
      return cachedScript;
    }

    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: null,
    };

    const { loadScript } = fragments[fragmentName];

    let wrappedScript = null;

    if (typeof loadScript === 'function') {
      let script;

      try {
        [script] = await Promise.all([loadScript(state), delay(options.importTimeout)]);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'load_script',
          recoverable: true,
        });
      }

      if (!script) {
        throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, {
          ...errData,
          level: levels.ERROR,
          code: 'time_out',
          recoverable: true,
        });
      }

      wrappedScript = wrapScript(script);
    }

    cachedScripts.set(fragmentName, wrappedScript);
    return wrappedScript;
  }

  const reconcile = initReconcile(slots, fragments, routes);
  const updateState = initUpdateState(routes, options);

  async function getSlotElement(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?Element> {
    const errData = {
      source: 'get_slot_element',
      fragment: fragmentName,
      slot: slotName,
    };

    const slot = slots[slotName];

    if (!slot) {
      throw new AppManagerError(`Slot ${slotName} could not be found.`, {
        ...errData,
        level: levels.ERROR,
        code: 'slot_not_found',
        recoverable: false,
      });
    }

    const { querySelector } = slot;

    if (!querySelector) {
      return null;
    }

    const element = await Promise.race([options.getElement(querySelector), delay(options.importTimeout)]);

    if (!element) {
      throw new AppManagerError(`Element ${querySelector} not found for slot ${slotName}.`, {
        ...errData,
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: false,
      });
    }

    return element;
  }

  async function* createLifecycle(slotName: SlotNameType, fragmentName: FragmentNameType, onError: OnErrorCallbackType, initialRender: boolean): LifecycleType {
    const script = await getFragmentScript(fragmentName);

    if (!script) {
      if (!initialRender) {
        const slot = slots[slotName];

        if (slot) {
          const { getErrorMarkup } = slot;

          if (typeof getErrorMarkup === 'function') {
            try {
              const errorSlotElement = await getSlotElement(slotName, fragmentName);

              if (errorSlotElement) {
                errorSlotElement.innerHTML = await getErrorMarkup(state);
              }
            } catch (err) {
              await onError(err);
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
        await script.onUpdateStatus(statusDetails, state);
      } catch (err) {
        await onError(err);
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
          const amError = new AppManagerError(err, {
            ...errData,
            level: levels.ERROR,
            code: 'unmount',
            recoverable: true,
          });

          await updateStatus(getErrorStatusDetails(amError));
          throw amError;
        }
      }
    }

    async function handleError(err) {
      try {
        await updateStatus(getErrorStatusDetails(err));
        await unmount();
      } catch (handleErrorErr) {
        await onError(handleErrorErr);
      }

      const slot = slots[slotName];

      if (slot) {
        const { getErrorMarkup } = slot;

        if (typeof getErrorMarkup === 'function') {
          try {
            const errorSlotElement = await getElement();

            if (errorSlotElement) {
              errorSlotElement.innerHTML = await getErrorMarkup(state);
            }
          } catch (handleErrorErr) {
            await onError(handleErrorErr);
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
        const amError = new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'mount',
          recoverable: true,
        });

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
          const amError = new AppManagerError(err, {
            ...errData,
            level: levels.ERROR,
            code: 'on_state_change',
            recoverable: true,
          });

          await handleError(err);
          throw amError;
        }
      }
    }

    await unmount();

    const slot = slots[slotName];

    if (slot) {
      const { getLoadingMarkup } = slot;

      if (typeof getLoadingMarkup === 'function') {
        try {
          const errorSlotElement = await getElement();

          if (errorSlotElement) {
            errorSlotElement.innerHTML = await getLoadingMarkup(state);
          }
        } catch (err) {
          await onError(err);
        }
      }
    }

    await updateStatus(defaultStatusDetails);

    return true;
  }

  async function handleLifecycleError(slotName: SlotNameType, err: Error): Promise<void> {
    if (mountedLifecycles.has(slotName)) {
      mountedLifecycles.delete(slotName);
    }

    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.throw(err)));
  }

  async function updateAllSlots(): Promise<void> {
    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.next(false)));
  }

  async function stateChanger(browserState: BrowserStateType, onRecoverableError?: OnErrorCallbackType): Promise<boolean> {
    const currentRoute = state ? state.route : null;
    const newState = await updateState(browserState, currentRoute);
    const onError = typeof onRecoverableError === 'function' ? onRecoverableError : (_) => {};

    if (!newState) {
      return false;
    }

    state = newState;

    const newRouteName = state.route.name;
    const prevRouteName = state.prevRoute ? state.prevRoute.name : null;
    const initialRender = !prevRouteName;

    const { unmount, mount, update } = reconcile(newRouteName, prevRouteName);

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    const updatePromises = () => slotsToUpdate.map(async (slotName) => {
      try {
        const lifecycle = mountedLifecycles.get(slotName);

        if (lifecycle) {
          const { value } = await lifecycle.next(false);
          return value;
        }

        return false;
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
        return false;
      }
    });

    const unmountPromises = () => slotsToUnmount.map(async (slotName) => {
      try {
        const lifecycle = mountedLifecycles.get(slotName);

        if (lifecycle) {
          const { value } = await lifecycle.next(true);
          mountedLifecycles.delete(slotName);
          return value;
        }

        return false;
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
        return false;
      }
    });

    const mountPromises = () => slotsToMount.map(async (slotName) => {
      const fragmentName = mount[slotName];

      if (mountedLifecycles.has(slotName)) {
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
        const lifecycle = await createLifecycle(slotName, fragmentName, onError, initialRender);
        const { value } = await lifecycle.next(false);
        mountedLifecycles.set(slotName, lifecycle);
        return value;
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
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

  // $FlowFixMe until https://github.com/facebook/flow/issues/285 is fixed.
  Object.defineProperty(stateChanger, 'state', {
    enumerable: true,
    get() { return state; },
  });

  return stateChanger;
}
