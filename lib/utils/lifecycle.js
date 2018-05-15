// @flow

import AppManagerError from './app-manager-error';
import { levels, statuses } from '../constants';

import type Context from './context';

import type {
  FragmentNameType,
  SlotNameType,
  OnErrorCallbackType,
  LifecycleType,
  SlotsMapType,
} from '../index';

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

export default function initCreateLifecycle(slots: SlotsMapType, getFragmentScript, getSlotElement, context: Context) {
  return async function* createLifecycle(slotName: SlotNameType, fragmentName: FragmentNameType, onError: OnErrorCallbackType, initialRender: boolean): LifecycleType {
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
                const state = context.getState();
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
      const state = context.getState();

      try {
        await script.onUpdateStatus(statusDetails, state);
      } catch (err) {
        await onError(err);
      }
    }

    async function getLifecycleElement() {
      try {
        return await getSlotElement(slotName, fragmentName);
      } catch (err) {
        await updateStatus(getErrorStatusDetails(err));
        throw err;
      }
    }

    async function unmount() {
      const unmountSlotElement = await getLifecycleElement();

      if (unmountSlotElement) {
        const state = context.getState();

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
            const errorSlotElement = await getLifecycleElement();

            if (errorSlotElement) {
              const state = context.getState();
              errorSlotElement.innerHTML = await getErrorMarkup(state);
            }
          } catch (handleErrorErr) {
            await onError(handleErrorErr);
          }
        }
      }
    }

    await updateStatus(loadingStatusDetails);

    const mountSlotElement = await getLifecycleElement();

    if (mountSlotElement) {
      const state = context.getState();

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
        const state = context.getState();

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
          const errorSlotElement = await getLifecycleElement();

          if (errorSlotElement) {
            const state = context.getState();
            errorSlotElement.innerHTML = await getLoadingMarkup(state);
          }
        } catch (err) {
          await onError(err);
        }
      }
    }

    await updateStatus(defaultStatusDetails);

    return true;
  };
}
