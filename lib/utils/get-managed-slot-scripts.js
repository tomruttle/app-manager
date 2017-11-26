// @flow

import type { SlotType, ScriptType, AppType } from '../index';

export default function getManagedSlotScripts(slots: { [slot: string]: SlotType } = {}, scripts: { [script: string]: ScriptType } = {}, app: AppType) {
  if (!app || !Array.isArray(app.display)) {
    return null;
  }

  const availableSlots = Object.keys(slots);

  const emptyAppSlots = availableSlots.reduce((emptySlots, slotName) => Object.assign(emptySlots, { [slots[slotName].name]: null }), {});

  function getValidSlots(scriptSlots) {
    return scriptSlots
      .filter((slotName) => availableSlots.includes(slotName))
      .slice(0, availableSlots.length);
  }

  const managedScripts = app.display
    .map((scriptName) => scripts[scriptName])
    .filter((script) => script && Array.isArray(script.slots) && script.managed === true)
    .map((script) => Object.assign({}, script, { slots: getValidSlots(script.slots) }))
    .filter((script) => script.slots.length > 0);

  if (managedScripts.length === 0) {
    return emptyAppSlots;
  }

  const firstScript = managedScripts[0];

  // @TODO Expand this algorithom to acceps arbitrary numbers of scripts and slots
  if (managedScripts.length === 2 && availableSlots.length >= 2) {
    const secondScript = managedScripts[1];

    if ((firstScript.slots.length === 1 || (firstScript.slots.length > 1 && secondScript.slots.length > 1))) {
      const firstScriptSlot = firstScript.slots[0];
      const secondScriptSlot = secondScript.slots.find((slot) => slot !== firstScriptSlot);

      if (secondScriptSlot) {
        return Object.assign({}, emptyAppSlots, { [firstScriptSlot]: firstScript.name, [secondScriptSlot]: secondScript.name });
      }
    }

    if (secondScript.slots.length === 1 && firstScript.slots.length > 1) {
      const secondScriptSlot = secondScript.slots[0];
      const firstScriptSlot = firstScript.slots.find((slot) => slot !== secondScriptSlot);

      if (firstScriptSlot) {
        return Object.assign({}, emptyAppSlots, { [firstScriptSlot]: firstScript.name, [secondScriptSlot]: secondScript.name });
      }
    }
  }

  // @TODO: Wrap this into the aforementioned algorithm
  if (managedScripts.length > 2) {
    return managedScripts.reduce((inSlots, script) => script.slots.reduce((scriptsInSlots, appScriptSlotName) => {
      if (scriptsInSlots.appScriptSlotName) {
        return scriptsInSlots;
      }

      return Object.assign({}, scriptsInSlots, { [appScriptSlotName]: script.name });
    }, inSlots), emptyAppSlots);
  }

  return Object.assign({}, emptyAppSlots, { [firstScript.slots[0]]: firstScript.name });
}
