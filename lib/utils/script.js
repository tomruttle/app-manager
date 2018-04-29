// @flow

import type {
  FragmentNameType,
  SlotNameType,
  StateWithAdditionsType,
  LoadedScriptType,
  ScriptType,
  StatusDetailsType,
  FragmentsMapType,
  OptionsType,
  FragmentType,
} from '../index';

import { delay } from './config';
import { levels } from '../constants';
import AppManagerError from './app-manager-error';

type LoadExternalScriptType = (fragment: FragmentType) => Promise<?LoadedScriptType>;

function getV5State(state) {
  const { route, prevRoute } = state;

  return Object.assign({}, state, {
    app: Object.assign({}, route, { appPath: route.path, appPaths: route.paths }),
    prevApp: prevRoute ? Object.assign({}, prevRoute, { appPath: prevRoute.path, appPaths: prevRoute.paths }) : null,
  });
}

export default function initScriptFunctions(fragments: FragmentsMapType, loadScript: LoadExternalScriptType, options: OptionsType) {
  function wrapScript(script: LoadedScriptType): ScriptType {
    return {
      async hydrate(slotElement: Element, state: StateWithAdditionsType) {
        switch (script.version) {
          case 4: {
            if (state) {
              if (typeof script.hydrate === 'function') {
                await script.hydrate(slotElement, state.route);
              } else {
                await script.mount(slotElement, 'am-replaceState', state.route);
              }
            }

            break;
          }

          case 5: {
            if (state) {
              const v5State = getV5State(state);

              if (typeof script.hydrate === 'function') {
                await script.hydrate(slotElement, v5State);
              } else if (typeof script.render === 'function') {
                await script.render(slotElement, v5State);
              }
            }

            break;
          }

          case 6: {
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

      async render(slotElement: Element, state: StateWithAdditionsType) {
        switch (script.version) {
          case 4: {
            await script.mount(slotElement, state.event, state.route);
            break;
          }

          case 5: {
            if (state) {
              const v5State = getV5State(state);

              if (typeof script.render === 'function') {
                await script.render(slotElement, v5State);
              }
            }

            break;
          }

          case 6: {
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

      async onStateChange(state: StateWithAdditionsType) {
        switch (script.version) {
          case 4: {
            if (state && typeof script.onStateChange === 'function') {
              await script.onStateChange(state.event, state.route);
            }

            break;
          }

          case 5: {
            if (state) {
              const v5State = getV5State(state);

              if (typeof script.onStateChange === 'function') {
                await script.onStateChange(v5State);
              }
            }

            break;
          }

          case 6: {
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

      async unmount(slotElement: Element, state: StateWithAdditionsType) {
        switch (script.version) {
          case 4: {
            await script.unmount(slotElement, state.event, state.prevRoute);
            break;
          }

          case 5: {
            if (state) {
              const v5State = getV5State(state);

              if (typeof script.unmount === 'function') {
                await script.unmount(slotElement, v5State);
              }
            }

            break;
          }

          case 6: {
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

      async onUpdateStatus(statusDetails: StatusDetailsType, state: StateWithAdditionsType) {
        switch (script.version) {
          case 4: {
            if (state && typeof script.onUpdateStatus === 'function') {
              await script.onUpdateStatus(statusDetails.status, state.route);
            }

            break;
          }

          case 5: {
            if (state) {
              const v5State = getV5State(state);

              if (typeof script.onUpdateStatus === 'function') {
                await script.onUpdateStatus(statusDetails, v5State);
              }
            }

            break;
          }

          case 6: {
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

  return async function loadWrappedScript(slotName: SlotNameType, fragmentName: FragmentNameType): Promise<?ScriptType> {
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

    if (typeof fragment.loadScript !== 'function') {
      return null;
    }

    const script = await Promise.race([loadScript(fragment), delay(options.importTimeout)]);

    if (!script) {
      throw new AppManagerError(`loadScript timed out for fragment ${fragmentName}.`, Object.assign({}, errData, {
        level: levels.ERROR,
        code: 'time_out',
        recoverable: true,
      }));
    }

    if (!script.version) {
      return null;
    }

    return wrapScript(script);
  };
}
