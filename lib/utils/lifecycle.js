// @flow

import { delay, getDefaultStatusDetails, getLoadingStatusDetails, getErrorStatusDetails } from './config';
import AppManagerError from './app-manager-error';

import type {
  ScriptType,
  FragmentNameType,
  SlotNameType,
  PageDiffType,
  LoadScriptType,
  LoadedScriptType,
} from '../index';

import { levels } from '../constants';

type FragmentsMapType = { [fragmentName: FragmentNameType]: { loadScript?: LoadScriptType } };
type OptionsType = { importTimeout: number };
type GetSlotElementType = (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?Element>;
type LifecycleType = AsyncGenerator<void, void, boolean>;

export default function initGetLifecycle(fragments: FragmentsMapType, wrapScript: (script: LoadedScriptType) => ScriptType, getSlotElement: GetSlotElementType, options: OptionsType) {
  const mountedLifecycles: { [slotName: SlotNameType]: LifecycleType } = {};
  const cachedScripts: { [fragmentName: FragmentNameType]: ScriptType } = {};

  const loadingStatusDetails = getLoadingStatusDetails();
  const defaultStatusDetails = getDefaultStatusDetails();

  async function loadScript(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<boolean> {
    if (cachedScripts[fragmentName]) {
      return true;
    }

    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: slotName,
    };

    const fragment = fragments[fragmentName];

    if (!fragment) {
      throw new AppManagerError(`Fragment ${fragmentName} could not be found`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: true,
      }));
    }

    if (typeof fragment.loadScript !== 'function') {
      return false;
    }

    let script;

    try {
      script = await Promise.race([fragment.loadScript(), delay(options.importTimeout)]);
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

    cachedScripts[fragmentName] = wrapScript(script);

    return true;
  }

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

    async function unmount() {
      let unmountSlotElement;

      try {
        unmountSlotElement = await getSlotElement(slotName, fragmentName);
      } catch (err) {
        script.onUpdateStatus(getErrorStatusDetails(err));
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

          script.onUpdateStatus(getErrorStatusDetails(amError));
          throw amError;
        }
      }
    }

    async function handleError(err) {
      script.onUpdateStatus(getErrorStatusDetails(err));
      await unmount();
    }

    try {
      await script.onUpdateStatus(loadingStatusDetails);
    } catch (_) {
      // Ignore these errors.
    }

    let mountSlotElement;

    try {
      mountSlotElement = await getSlotElement(slotName, fragmentName);
    } catch (err) {
      script.onUpdateStatus(getErrorStatusDetails(err));
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

        try {
          handleError(err);
        } catch (_) {
          // Ignore these errors.
        }

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
          try {
            await script.onUpdateStatus(getErrorStatusDetails(err));
          } catch (_) {
            // Ignore these errors.
          }
        }
      }

      try {
        await script.onUpdateStatus(defaultStatusDetails);
      } catch (_) {
        // Ignore these errors.
      }

      stop = yield;

      try {
        await script.onUpdateStatus(loadingStatusDetails);
      } catch (_) {
        // Ignore these errors.
      }

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

          try {
            handleError(err);
          } catch (_) {
            // Ignore these errors.
          }

          throw amError;
        }
      }
    }

    await unmount();

    try {
      await script.onUpdateStatus(defaultStatusDetails);
    } catch (_) {
      // Ignore these errors.
    }
  }

  async function handleLifecycleError(slotName: SlotNameType, err) {
    if (mountedLifecycles[slotName]) {
      delete mountedLifecycles[slotName];
    }

    const errorPromises = () => Object.keys(mountedLifecycles).map((errorSlot) => mountedLifecycles[errorSlot].throw(err));
    await Promise.all(errorPromises());
  }

  async function updateAllSlots() {
    const updateAllSlotsPromises = () => Object.keys(mountedLifecycles).map((statusSlot) => mountedLifecycles[statusSlot].next(false));
    return Promise.all(updateAllSlotsPromises());
  }

  return async function updatePage(pageDiff: PageDiffType, initialRender: boolean): Promise<boolean> {
    const { unmount, mount, update } = pageDiff;

    const onError = typeof options.onError === 'function' ? options.onError : (_err) => {};

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    const loadScriptPromises = () => slotsToMount.map(async (slotName) => {
      let hasScript = false;

      try {
        hasScript = await loadScript(slotName, mount[slotName]);
      } catch (err) {
        await handleLifecycleError(err);
        onError(err);
        hasScript = true;
      }

      return hasScript;
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
    const haveScripts = await Promise.all(loadScriptPromises());
    await Promise.all([...unmountPromises(), ...updatePromises()]);
    await Promise.all(mountPromises());
    await updateAllSlots();

    return haveScripts.every(Boolean);
  };
}
