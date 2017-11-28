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

function filterLessImportantScriptSlots(scripts: Array<ScriptType>, neededSlot: string, startIndex: number): Array<ScriptType> {
  return scripts
    .reduce((filteredScripts, script, index) => {
      if (index <= startIndex) {
        return filteredScripts;
      }

      return [
        ...filteredScripts.slice(0, index),
        Object.assign({}, script, { slots: script.slots.filter((slotName) => slotName !== neededSlot) }),
        ...filteredScripts.slice(index + 1),
      ];
    }, scripts);
}

function ensurePriorityScripts(scripts: Array<ScriptType>): Array<ScriptType> {
  return scripts
    .reduce((filteredScripts, script, index) => (
      script.slots.length === 1
        ? filterLessImportantScriptSlots(filteredScripts, script.slots[0], index)
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

function calculateSlots(allScripts: Array<ScriptType>, numSlots: number) {
  function getSlots(test: Array<ScriptType>, offset: number, scripts: Array<ScriptType>, longestChain: Array<ScriptType>) {
    return scripts.reduce((scriptChain, script, scriptIndex) => {
      if (scriptChain.length >= numSlots) {
        return scriptChain;
      }

      const lessImportantScripts = scripts.slice(scriptIndex + 1);

      return script.slots.reduce((slotChain, slot) => {
        if (slotChain.length >= numSlots) {
          return slotChain;
        }

        const nextTest = [
          ...test.slice(0, scriptIndex + offset),
          Object.assign({}, script, { slots: [slot] }),
          ...test.slice(scriptIndex + offset + 1),
        ];

        if (lessImportantScripts.length > 0) {
          return getSlots(nextTest, offset + 1, lessImportantScripts, slotChain);
        }

        const nextChain = getChain(nextTest);

        return nextChain.length > slotChain.length ? nextChain : slotChain;
      }, scriptChain);
    }, longestChain);
  }

  const seed = allScripts.map((script) => Object.assign({}, script, { slots: [script.slots[0]] }));

  return getSlots(seed, 0, allScripts, []);
}

export default function getManagedSlotScripts(slots: SlotsType = {}, scripts: ScriptsType = {}, app: AppType) {
  if (!app || !Array.isArray(app.display)) {
    return null;
  }

  const managedScripts = getManagedScripts(slots, scripts, app.display);

  const availableSlots = Object.keys(slots);

  const ensuredScripts = [...Array(availableSlots.length)].reduce(ensurePriorityScripts, managedScripts);

  const filteredScripts = calculateSlots(ensuredScripts, availableSlots.length);

  const emptyAppSlots = availableSlots.reduce((emptySlots, slotName) => Object.assign(emptySlots, { [slots[slotName].name]: null }), {});

  return filteredScripts.reduce((scriptsInSlots, script) => Object.assign({}, scriptsInSlots, { [script.slots[0]]: script.name }), emptyAppSlots);
}
