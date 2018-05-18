// @flow

import AppManagerError from './app-manager-error';
import { levels } from '../constants';

import type {
  StateWithAdditionsType,
  StatusDetailsType,
  LoadedScriptType,
  ScriptType,
} from '../index';

export function getV5State(state: StateWithAdditionsType) {
  const { route = {}, prevRoute } = state;

  const app = {};

  if (route.fragment) {
    Object.assign(app, { fragment: route.fragment });
  }

  if (route.fragments) {
    Object.assign(app, { fragments: route.fragments });
  }

  if (route.path) {
    Object.assign(app, { appPath: route.path });
  }

  if (route.paths) {
    Object.assign(app, { appPaths: route.paths });
  }

  let prevApp = null;

  if (prevRoute) {
    prevApp = {};

    if (prevRoute.fragment) {
      Object.assign(prevApp, { fragment: prevRoute.fragment });
    }

    if (prevRoute.fragments) {
      Object.assign(prevApp, { fragments: prevRoute.fragments });
    }

    if (prevRoute.path) {
      Object.assign(prevApp, { appPath: prevRoute.path });
    }

    if (prevRoute.paths) {
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

export default function wrapScript(script: LoadedScriptType): ScriptType {
  return {
    async hydrate(slotElement: Element, state: StateWithAdditionsType) {
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

    async render(slotElement: Element, state: StateWithAdditionsType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.mount === 'function') {
              await script.mount(slotElement, state.event, v5State.app);
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

    async onStateChange(state: StateWithAdditionsType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.onStateChange === 'function') {
              await script.onStateChange(state.event, v5State.app);
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
            await script.onStateChange(state);
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

    async unmount(slotElement: Element, state: StateWithAdditionsType) {
      switch (script.version) {
        case 4: {
          if (state) {
            const v5State = getV5State(state);

            if (typeof script.unmount === 'function') {
              await script.unmount(slotElement, state.event, v5State.prevApp);
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

    async onUpdateStatus(statusDetails: StatusDetailsType, state: StateWithAdditionsType) {
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
