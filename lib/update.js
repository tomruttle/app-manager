// @flow

import AppManagerError from './utils/app-manager-error';
import { levels } from './constants';

import type {
  BrowserStateType,
  SlotNameType,
  OnErrorCallbackType,
  LifecycleType,
} from './index';

import type Context from './utils/context';
import type { ReconcileType } from './reconcile';
import type { CreateLifecycleType } from './lifecycle';
import type { UpdateStateType } from './state';

export type UpdatePageType = (browserState: BrowserStateType, onRecoverableError?: OnErrorCallbackType) => Promise<boolean>;

export default function initUpdatePage(reconcile: ReconcileType, createLifecycle: CreateLifecycleType, updateState: UpdateStateType, context: Context): UpdatePageType {
  const mountedLifecycles: Map<SlotNameType, LifecycleType> = new Map();
  let initialRender = true;

  async function handleLifecycleError(slotName: SlotNameType, err: Error): Promise<void> {
    mountedLifecycles.delete(slotName);

    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.throw(err)));
  }

  async function updateAllSlots(): Promise<void> {
    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.next(false)));
  }

  return async function updatePage(browserState, onRecoverableError) {
    const currentRoute = !initialRender ? context.state.route : null;

    initialRender = false;

    const state = await updateState(browserState, currentRoute);

    if (!state) {
      return false;
    }

    context.setState(state);

    const newRouteName = state.route.name;
    const prevRouteName = state.prevRoute ? state.prevRoute.name : null;

    const { unmount, mount, update } = reconcile(newRouteName, prevRouteName);

    const slotsToUpdate = Object.keys(update);
    const slotsToUnmount = Object.keys(unmount);
    const slotsToMount = Object.keys(mount);

    async function onError(err) {
      try {
        if (typeof onRecoverableError === 'function') {
          await onRecoverableError(err);
        }
      } catch (_err) {
        // Throw the error away.
      }
    }

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
        const lifecycle = await createLifecycle(slotName, fragmentName, onError);
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

    return haveScripts.every(Boolean) || state.initialRender;
  };
}
