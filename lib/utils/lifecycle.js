// @flow

import { getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptType,
  FragmentNameType,
  SlotNameType,
  PageDiffType,
  LoadScriptType,
} from '../index';

import { levels } from '../constants';

type FragmentsMapType = { [fragmentName: FragmentNameType]: { loadScript?: LoadScriptType } };
type OptionsType = { importTimeout: number };
type GetSlotElementType = (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?Element>;
type LifecycleType = AsyncGenerator<void, void, boolean>;

export default function initGetLifecycle(fragments: FragmentsMapType, loadScript: (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?ScriptType>, getSlotElement: GetSlotElementType, options: OptionsType) {
  const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};
  const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

  const loadingStatusDetails = getLoadingStatusDetails();
  const defaultStatusDetails = getDefaultStatusDetails();

  async function* createLifecycle(slotName: SlotNameType, fragmentName: FragmentNameType, initialRender: boolean): LifecycleType {
    const script = cachedScripts[fragmentName];

    if (!script) {
      return;
    }

    const errData = {
      source: 'state_changer',
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

    async function unmount() {
      let unmountSlotElement;

      try {
        unmountSlotElement = await getSlotElement(slotName, fragmentName);
      } catch (err) {
        await updateStatus(getErrorStatusDetails(err));
        throw err;
      }

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
    }

    await updateStatus(loadingStatusDetails);

    let mountSlotElement;

    try {
      mountSlotElement = await getSlotElement(slotName, fragmentName);
    } catch (err) {
      await updateStatus(getErrorStatusDetails(err));
      throw err;
    }

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
          stop = yield;
          break;
        } catch (err) {
          await updateStatus(getErrorStatusDetails(err));
        }
      }

      await updateStatus(defaultStatusDetails);

      stop = yield;

      await updateStatus(loadingStatusDetails);

      stop = yield;

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

    await updateStatus(defaultStatusDetails);
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

    const onError = typeof options.onError === 'function' ? options.onError : (_err) => {};

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    const loadScriptPromises = () => slotsToMount.map(async (slotName) => {
      const fragmentName = mount[slotName];

      if (cachedScripts[fragmentName]) {
        return true;
      }

      try {
        const script = await loadScript(slotName, fragmentName);

        if (!script) {
          return false;
        }

        cachedScripts[fragmentName] = script;
        return true;
      } catch (err) {
        await handleLifecycleError(slotName, err);
        onError(err);
        return false;
      }
    });

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
        await mountedLifecycles[slotName].next(false);
      } catch (err) {
        await handleLifecycleError(slotName, err);
        onError(err);
      }
    });

    await updateAllSlots();
    await Promise.all(updatePromises());
    await Promise.all(unmountPromises());
    const haveScripts = await Promise.all(loadScriptPromises());
    await Promise.all(mountPromises());
    await updateAllSlots();

    return haveScripts.every(Boolean);
  };
}
