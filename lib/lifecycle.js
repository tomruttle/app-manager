// @flow

import AppManagerError from './utils/app-manager-error';
import { levels, statuses, eventTitles } from './constants';

import type {
  FragmentNameType,
  SlotNameType,
  OnErrorCallbackType,
  LifecycleType,
  SlotsMapType,
} from './index';

import type Context from './utils/context';
import type { GetFragmentScriptType } from './script';
import type { GetSlotElementType } from './element';

export type CreateLifecycleType = (container: Element, slotName: SlotNameType, fragmentName: FragmentNameType) => LifecycleType;

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

export default function initCreateLifecycle(slots: SlotsMapType, getFragmentScript: GetFragmentScriptType, getSlotElement: GetSlotElementType, context: Context, onRecoverableError: OnErrorCallbackType): CreateLifecycleType {
  return async function* createLifecycle(container, slotName, fragmentName) {
    const errData = {
      source: 'lifecycle',
      fragment: fragmentName,
      slot: slotName,
    };

    const slot = slots[slotName];

    async function getScript() {
      try {
        return await getFragmentScript(fragmentName);
      } catch (err) {
        const { getErrorMarkup } = slot;

        if (typeof getErrorMarkup === 'function') {
          try {
            const errorSlotElement = await getSlotElement(container, slotName, fragmentName);

            if (errorSlotElement) {
              errorSlotElement.innerHTML = await getErrorMarkup(context.state);
            }
          } catch (getElementError) {
            onRecoverableError(getElementError);
          }
        }

        onRecoverableError(err);

        throw err;
      }
    }

    const script = await getScript();

    if (!script) {
      if (context.state.eventTitle === eventTitles.INITIALISE) {
        return;
      }

      throw new AppManagerError('Tried to navigate to fragment without a script.', {
        ...errData,
        level: levels.ERROR,
        code: 'get_script',
        recoverable: true,
      });
    }

    async function updateStatus(statusDetails) {
      try {
        await script.onUpdateStatus(statusDetails, context.state);
      } catch (err) {
        onRecoverableError(err);
      }
    }

    async function getLifecycleElement() {
      try {
        return await getSlotElement(container, slotName, fragmentName);
      } catch (err) {
        await updateStatus(getErrorStatusDetails(err));
        throw err;
      }
    }

    async function unmount() {
      const unmountSlotElement = await getLifecycleElement();

      if (unmountSlotElement) {
        try {
          await script.unmount(unmountSlotElement, context.state);
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
        onRecoverableError(handleErrorErr);
      }

      const { getErrorMarkup } = slot;

      if (typeof getErrorMarkup === 'function') {
        try {
          const errorSlotElement = await getLifecycleElement();

          if (errorSlotElement) {
            errorSlotElement.innerHTML = await getErrorMarkup(context.state);
          }
        } catch (handleErrorErr) {
          onRecoverableError(handleErrorErr);
        }
      }
    }

    await updateStatus(loadingStatusDetails);

    const mountSlotElement = await getLifecycleElement();

    if (mountSlotElement) {
      try {
        if (context.state.eventTitle === eventTitles.INITIALISE) {
          await script.hydrate(mountSlotElement, context.state);
        } else {
          await script.render(mountSlotElement, context.state);
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

    let stop = false;

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
          await script.onStateChange(container, context.state);
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

    const { getLoadingMarkup } = slot;

    if (typeof getLoadingMarkup === 'function') {
      try {
        const errorSlotElement = await getLifecycleElement();

        if (errorSlotElement) {
          errorSlotElement.innerHTML = await getLoadingMarkup(context.state);
        }
      } catch (err) {
        onRecoverableError(err);
      }
    }

    await updateStatus(defaultStatusDetails);
  };
}
