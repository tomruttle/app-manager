// @flow

import AppManagerError from './app-manager-error';
import { levels } from '../constants';

import type {
  StateType,
  StatusDetailsType,
  LoadedScriptType,
  ScriptType,
  AppManagerScriptType,
} from '../index';

export function getV5State(state: StateType) {
  const { route, prevRoute } = state;

  let app = null;

  if (route) {
    app = {};

    if (typeof route.fragment === 'string') {
      Object.assign(app, { fragment: route.fragment });
    }

    if (Array.isArray(route.fragments)) {
      Object.assign(app, { fragments: route.fragments });
    }

    if (typeof route.path === 'string') {
      Object.assign(app, { appPath: route.path });
    }

    if (Array.isArray(route.paths)) {
      Object.assign(app, { appPaths: route.paths });
    }
  }

  let prevApp = null;

  if (prevRoute) {
    prevApp = {};

    if (typeof prevRoute.fragment === 'string') {
      Object.assign(prevApp, { fragment: prevRoute.fragment });
    }

    if (Array.isArray(prevRoute.fragments)) {
      Object.assign(prevApp, { fragments: prevRoute.fragments });
    }

    if (typeof prevRoute.path === 'string') {
      Object.assign(prevApp, { appPath: prevRoute.path });
    }

    if (Array.isArray(prevRoute.paths)) {
      Object.assign(prevApp, { appPaths: prevRoute.paths });
    }
  }

  return { ...state, app, prevApp };
}

const errData = {
  source: 'wrap_script',
  fragment: null,
  slot: null,
};

export default function wrapScript(script: LoadedScriptType | AppManagerScriptType): ScriptType {
  return {
    version: script.version,

    async hydrate(slotElement: Element, state: StateType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.hydrate === 'function') {
              await script.hydrate(slotElement, v5State.app);
            } else if (typeof script.mount === 'function') {
              await script.mount(slotElement, 'am-replaceState', v5State.app);
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
          throw new AppManagerError('Script has invalid version.', {
            ...errData,
            level: levels.ERROR,
            code: 'invalid_version',
            recoverable: false,
          });
        }
      }
    },

    async render(slotElement: Element, state: StateType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.mount === 'function') {
              await script.mount(slotElement, state.eventTitle, v5State.app);
            }
          }

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
          throw new AppManagerError('Script has invalid version.', {
            ...errData,
            level: levels.ERROR,
            code: 'invalid_version',
            recoverable: false,
          });
        }
      }
    },

    async onStateChange(slotElement: Element, state: StateType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.onStateChange === 'function') {
              await script.onStateChange(state.eventTitle, v5State.app);
            }
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
            await script.onStateChange(slotElement, state);
          }

          break;
        }

        default: {
          throw new AppManagerError('Script has invalid version.', {
            ...errData,
            level: levels.ERROR,
            code: 'invalid_version',
            recoverable: false,
          });
        }
      }
    },

    async unmount(slotElement: Element, state: StateType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.unmount === 'function') {
              await script.unmount(slotElement, state.eventTitle, v5State.prevApp);
            }
          }

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
          throw new AppManagerError('Script has invalid version.', {
            ...errData,
            level: levels.ERROR,
            code: 'invalid_version',
            recoverable: false,
          });
        }
      }
    },

    async onUpdateStatus(statusDetails: StatusDetailsType, state: StateType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.onUpdateStatus === 'function') {
              await script.onUpdateStatus(statusDetails.status, v5State.app);
            }
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
          throw new AppManagerError('Script has invalid version.', {
            ...errData,
            level: levels.ERROR,
            code: 'invalid_version',
            recoverable: false,
          });
        }
      }
    },
  };
}
