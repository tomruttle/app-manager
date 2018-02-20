// @flow

import { getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails, retry } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptType,
  FragmentNameType,
  SlotsMapType,
  SlotNameType,
  PageDiffType,
  LoadScriptType,
} from '../index';
import type Window from './window-stub';

import { levels } from '../constants';

type FragmentsMapType = { [fragmentName: FragmentNameType]: { loadScript?: LoadScriptType } };
type OptionsType = { importTimeout: number, domCheckInterval: number };
type LifecycleType = AsyncGenerator<true, boolean, boolean>;

export default function initGetLifecycle(w: Window, fragments: FragmentsMapType, slots: SlotsMapType, loadScript: (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?ScriptType>, options: OptionsType) {
  const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};

  const onError = typeof options.onError === 'function' ? options.onError : (_err) => {};

  const loadingStatusDetails = getLoadingStatusDetails();
  const defaultStatusDetails = getDefaultStatusDetails();

  function selectFromDom(querySelector: string): ?Element {
    return w.document.querySelector(querySelector);
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

    const element = await retry(
      () => selectFromDom(querySelector),
      options.domCheckInterval,
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

  async function* createLifecycle(slotName: SlotNameType, fragmentName: FragmentNameType, initialRender: boolean): LifecycleType {
    const script = await loadScript(slotName, fragmentName);

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
        await script.onUpdateStatus(statusDetails);
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
          await script.unmount(unmountSlotElement);
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
          await script.hydrate(mountSlotElement);
        } else {
          await script.render(mountSlotElement);
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
          await script.onStateChange();
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

  return async function updatePage(pageDiff: PageDiffType, initialRender: boolean): Promise<boolean> {
    const { unmount, mount, update } = pageDiff;

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    const updatePromises = () => slotsToUpdate.map(async (slotName) => {
      try {
        if (mountedLifecycles[slotName]) {
          await mountedLifecycles[slotName].next(false);
        }
      } catch (err) {
        await handleLifecycleError(slotName, err);
        onError(err);
      }
    });

    const unmountPromises = () => slotsToUnmount.map(async (slotName) => {
      try {
        if (mountedLifecycles[slotName]) {
          await mountedLifecycles[slotName].next(true);
          delete mountedLifecycles[slotName];
        }
      } catch (err) {
        await handleLifecycleError(slotName, err);
        onError(err);
      }
    });

    const mountPromises = () => slotsToMount.map(async (slotName) => {
      const fragmentName = mount[slotName];

      try {
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

        mountedLifecycles[slotName] = await createLifecycle(slotName, fragmentName, initialRender);
        const { value } = await mountedLifecycles[slotName].next(false);
        return value;
      } catch (err) {
        await handleLifecycleError(slotName, err);
        onError(err);
        return false;
      }
    });

    await updateAllSlots();
    await Promise.all(updatePromises());
    await Promise.all(unmountPromises());
    const haveScripts = await Promise.all(mountPromises());
    await updateAllSlots();

    return haveScripts.every(Boolean);
  };
}
