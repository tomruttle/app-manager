// @flow

import AppManagerError from './utils/app-manager-error';
import { delay } from './utils/config';
import { levels } from './constants';

import type {
  FragmentNameType,
  SlotNameType,
  SlotsMapType,
  GetElementType,
} from './index';

export type GetSlotElementType = (slotName: SlotNameType, fragmentName: FragmentNameType) => Promise<?Element>;

export default function initGetElement(slots: SlotsMapType, getElement: GetElementType, importTimeout: number): GetSlotElementType {
  return async function getSlotElement(slotName, fragmentName) {
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

    const element = await Promise.race([getElement(querySelector), delay(importTimeout)]);

    if (!element) {
      throw new AppManagerError(`Element ${querySelector} not found for slot ${slotName}.`, {
        ...errData,
        level: levels.ERROR,
        code: 'element_not_found',
        recoverable: false,
      });
    }

    return element;
  };
}
