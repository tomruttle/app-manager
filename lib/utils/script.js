// @flow

import type {
  FragmentNameType,
  SlotNameType,
  GetStateType,
  LoadedScriptType,
  ScriptType,
  StatusDetailsType,
  FragmentsMapType,
  OptionsType,
} from '../index';

import { delay } from './config';
import { eventTitles, levels } from '../constants';
import AppManagerError from './app-manager-error';

export default function initScriptFunctions(w: { history: Object }, fragments: FragmentsMapType, options: OptionsType, getState: GetStateType) {
  function wrapScript(script: LoadedScriptType): ScriptType {
    return {
      async hydrate(slotElement: Element) {
        const state = getState();

        switch (script.version) {
          case 3: {
            if (state && state.app) {
              await script.hydrate(slotElement, w.history, state.app);
            }

            break;
          }

          case 4: {
            if (state) {
              if (typeof script.hydrate === 'function') {
                await script.hydrate(slotElement, state.app);
              } else {
                await script.mount(slotElement, eventTitles.HISTORY_REPLACE_STATE, state.app);
              }
            }

            break;
          }

          case 5: {
            if (state) {
              if (typeof script.hydrate === 'function') {
                await script.hydrate(slotElement, state);
              } else if (typeof script.render === 'function') {
                await script.render(slotElement, state);
              }
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },

      async render(slotElement: Element) {
        const state = getState();

        switch (script.version) {
          case 3: {
            if (state) {
              await script.mount(slotElement, w.history, state.app);
            }

            break;
          }

          case 4: {
            if (state && state.event) {
              await script.mount(slotElement, state.event, state.app);
            }

            break;
          }

          case 5: {
            if (state && typeof script.render === 'function') {
              await script.render(slotElement, state);
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },

      async onStateChange() {
        const state = getState();

        switch (script.version) {
          case 3: {
            if (state) {
              await script.onStateChange(w.history, state.app);
            }

            break;
          }

          case 4: {
            if (state && typeof script.onStateChange === 'function') {
              if (state.event) {
                await script.onStateChange(state.event, state.app);
              }
            }

            break;
          }

          case 5: {
            if (state && typeof script.onStateChange === 'function') {
              await script.onStateChange(state);
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },

      async unmount(slotElement: Element) {
        const state = getState();

        switch (script.version) {
          case 3: {
            if (state && state.prevApp) {
              await script.unmount(slotElement, w.history, state.prevApp);
            }

            break;
          }

          case 4: {
            if (state && state.event && state.prevApp) {
              await script.unmount(slotElement, state.event, state.prevApp);
            }

            break;
          }

          case 5: {
            if (state && typeof script.unmount === 'function') {
              await script.unmount(slotElement, state);
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },

      async onUpdateStatus(statusDetails: StatusDetailsType) {
        const state = getState();

        switch (script.version) {
          case 3: break;

          case 4: {
            if (state && typeof script.onUpdateStatus === 'function') {
              await script.onUpdateStatus(statusDetails.status, state.app);
            }

            break;
          }

          case 5: {
            if (state && typeof script.onUpdateStatus === 'function') {
              await script.onUpdateStatus(statusDetails, state);
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },
    };
  }

  return async function loadScript(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?ScriptType> {
    const errData = {
      source: 'load_script',
      fragment: fragmentName,
      slot: slotName,
    };

    const fragment = fragments[fragmentName];

    if (!fragment) {
      throw new AppManagerError(`Fragment ${fragmentName} could not be found`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'missing_fragment',
        recoverable: true,
      }));
    }

    const state = getState();

    if (typeof fragment.loadScript !== 'function' || !state) {
      return null;
    }

    let script;

    try {
      script = await Promise.race([fragment.loadScript(state), delay(options.importTimeout)]);
    } catch (err) {
      throw new AppManagerError(err, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'load_script',
        recoverable: true,
      }));
    }

    if (!script) {
      throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'time_out',
        recoverable: true,
      }));
    }

    return wrapScript(script);
  };
}
