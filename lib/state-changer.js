// @flow

import AppManagerError from './utils/app-manager-error';
import { levels } from './constants';

import type {
  BrowserStateType,
  SlotNameType,
  OnErrorCallbackType,
  LifecycleType,
  ContextType,
} from './index';

import type { ReconcileType } from './reconcile';
import type { CreateLifecycleType } from './lifecycle';
import type { UpdateStateType } from './state';

export type StateChangerType = (browserState: BrowserStateType, onRecoverableError?: OnErrorCallbackType) => Promise<boolean>;

export default function initStateChanger(reconcile: ReconcileType, createLifecycle: CreateLifecycleType, updateState: UpdateStateType, context: ContextType): StateChangerType {
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

  async function stateChanger(browserState, onRecoverableError) {
    const currentRoute = context.state ? context.state.route : null;
    const newState = await updateState(browserState, currentRoute);

    if (!newState) {
      return false;
    }

    const state = context.setState(newState);

    const newRouteName = state.route.name;
    const prevRouteName = state.prevRoute ? state.prevRoute.name : null;
    const initialRender = !prevRouteName;

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
    get() { return context.state; },
  });

  return stateChanger;
}
