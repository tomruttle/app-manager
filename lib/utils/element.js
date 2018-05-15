// @flow

import AppManagerError from './app-manager-error';
import { delay } from './config';
import { levels } from '../constants';

import type {
  FragmentNameType,
  SlotNameType,
  SlotsMapType,
} from '../index';

export default function initGetElement(slots: SlotsMapType, getElement, importTimeout: number) {
  return async function getSlotElement(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?Element> {
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
