// @flow

import type { SlotType, ScriptType, AppType } from '../index';

type SlotsType = { [slot: string]: SlotType };
type ScriptsType = { [script: string]: ScriptType };

function getManagedScripts(slots: SlotsType = {}, scripts: ScriptsType = {}, appDisplay: Array<string>): Array<ScriptType> {
  const availableSlots = Object.keys(slots);

  return appDisplay
    .map((scriptName) => scripts[scriptName])
    .filter((script) => script && Array.isArray(script.slots) && script.managed === true)
    .map((script) => Object.assign({}, script, { slots: script.slots.filter((slotName) => availableSlots.includes(slotName)) }))
    .filter((script) => script.slots.length > 0);
}

function filterLessImportantScripts(scripts: Array<ScriptType>, neededSlot: string, startIndex: number): Array<ScriptType> {
  return scripts
    .reduce((nestedFilteredScripts, nestedScript, nestedIndex) => {
      if (nestedIndex <= startIndex) {
        return nestedFilteredScripts;
      }

      const newSlots = nestedScript.slots.filter((slotName) => slotName !== neededSlot);
      const newScript = newSlots.length > 0 ? Object.assign({}, nestedScript, { slots: newSlots }) : null;

      return [...nestedFilteredScripts.slice(0, nestedIndex), newScript, ...nestedFilteredScripts.slice(nestedIndex + 1)].filter(Boolean);
    }, scripts);
}

function ensurePriorityScripts(scripts: Array<ScriptType>): Array<ScriptType> {
  return scripts
    .reduce((filteredScripts, script, index) => (
      script.slots.length === 1
        ? filterLessImportantScripts(filteredScripts, script.slots[0], index)
        : filteredScripts
    ), scripts);
}

function getChain(scripts: Array<ScriptType>): Array<ScriptType> {
  const usedSlots = [];

  const firstSeenIndex = scripts.findIndex((script) => {
    const slot = script.slots[0];

    if (usedSlots.includes(slot)) {
      return true;
    }

    usedSlots.push(slot);
    return false;
  });

  return firstSeenIndex === -1 ? scripts : scripts.slice(0, firstSeenIndex);
}

function getNthSlot(script: ScriptType, n: number): ScriptType {
  return Object.assign({}, script, { slots: script.slots.filter((slotName, index) => index === n) });
}

function calculateSlots(test, offset, scripts, longestChain, numSlots) {
  return scripts.reduce((scriptChain, script, scriptIndex) => {
    if (scriptChain.length >= numSlots) {
      return scriptChain;
    }

    const lowerScripts = scripts.slice(scriptIndex + 1);

    return script.slots.reduce((slotChain, slot, slotIndex) => {
      if (slotChain.length >= numSlots) {
        return slotChain;
      }

      const nextSeed = [...test.slice(0, scriptIndex + offset), getNthSlot(script, slotIndex), ...test.slice(scriptIndex + offset + 1)];

      if (lowerScripts.length > 0) {
        return calculateSlots(nextSeed, offset + 1, lowerScripts, slotChain, numSlots);
      }

      const nextChain = getChain(nextSeed);

      return nextChain.length > slotChain.length ? nextChain : slotChain;
    }, scriptChain);
  }, longestChain);
}

export default function getManagedSlotScripts(slots: SlotsType = {}, scripts: ScriptsType = {}, app: AppType) {
  if (!app || !Array.isArray(app.display)) {
    return null;
  }

  const availableSlots = Object.keys(slots);

  const emptyAppSlots = availableSlots.reduce((emptySlots, slotName) => Object.assign(emptySlots, { [slots[slotName].name]: null }), {});

  const managedScripts = getManagedScripts(slots, scripts, app.display);

  const ensuredScripts = [...Array(availableSlots.length)].reduce(ensurePriorityScripts, managedScripts);

  const seed = ensuredScripts.map((script) => getNthSlot(script, 0));
  const filteredScripts = calculateSlots(seed, 0, ensuredScripts, [], availableSlots.length);

  return filteredScripts.reduce((scriptsInSlots, script) => Object.assign({}, scriptsInSlots, { [script.slots[0]]: script.name }), emptyAppSlots);
}
