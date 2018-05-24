// @flow

import AppManagerError from './utils/app-manager-error';
import { levels } from './constants';

import type {
  StateWithAdditionsType,
  SlotNameType,
  OnErrorCallbackType,
  LifecycleType,
} from './index';

import type { ReconcileType } from './reconcile';
import type { CreateLifecycleType } from './lifecycle';

export type UpdatePageType = (container: Element, state: StateWithAdditionsType) => Promise<void>;

export default function initUpdatePage(reconcile: ReconcileType, createLifecycle: CreateLifecycleType, onRecoverableError?: OnErrorCallbackType): UpdatePageType {
  const mountedLifecycles: Map<SlotNameType, LifecycleType> = new Map();

  async function handleLifecycleError(slotName: SlotNameType, err: Error): Promise<void> {
    mountedLifecycles.delete(slotName);

    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.throw(err)));
  }

  async function updateAllSlots(): Promise<void> {
    const lifecyclesArray = Array.from(mountedLifecycles.values());
    await Promise.all(lifecyclesArray.map((lifecycle) => lifecycle.next(false)));
  }

  return async function updatePage(container, state) {
    if (!state.route) {
      return;
    }

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
          await lifecycle.next(false);
        }
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
      }
    });

    const unmountPromises = () => slotsToUnmount.map(async (slotName) => {
      try {
        const lifecycle = mountedLifecycles.get(slotName);

        if (lifecycle) {
          await lifecycle.next(true);
          mountedLifecycles.delete(slotName);
        }
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
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
        const lifecycle = await createLifecycle(container, slotName, fragmentName, onError);
        await lifecycle.next(false);
        mountedLifecycles.set(slotName, lifecycle);
      } catch (err) {
        await handleLifecycleError(slotName, err);
        await onError(err);
      }
    });

    await updateAllSlots();

    await Promise.all(updatePromises());
    await Promise.all(unmountPromises());
    await Promise.all(mountPromises());

    await updateAllSlots();
  };
}
