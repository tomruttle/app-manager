// @flow

import AppManagerError from './utils/app-manager-error';
import { delay } from './utils/config';
import { levels } from './constants';
import wrapScript, { type ScriptType } from './utils/wrap-script';

import type {
  FragmentsMapType,
  FragmentNameType,
} from './index';

import type Context from './utils/context';

export type GetFragmentScriptType = (fragmentName: FragmentNameType) => Promise<?ScriptType>

export default function initGetFragmentScript(fragments: FragmentsMapType, importTimeout: number, context: Context): GetFragmentScriptType {
  const cachedScripts: Map<FragmentNameType, ?ScriptType> = new Map();

  return async function getFragmentScript(fragmentName) {
    const cachedScript = cachedScripts.get(fragmentName);

    if (cachedScript) {
      return cachedScript;
    }

    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: null,
    };

    const { loadScript } = fragments[fragmentName];

    let wrappedScript = null;

    if (typeof loadScript === 'function') {
      let script;

      try {
        [script] = await Promise.all([loadScript(context.state), delay(importTimeout)]);
      } catch (err) {
        throw new AppManagerError(err, {
          ...errData,
          level: levels.ERROR,
          code: 'load_script',
          recoverable: true,
        });
      }

      if (!script) {
        throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, {
          ...errData,
          level: levels.ERROR,
          code: 'time_out',
          recoverable: true,
        });
      }

      wrappedScript = wrapScript(script);
    }

    cachedScripts.set(fragmentName, wrappedScript);
    return wrappedScript;
  };
}
