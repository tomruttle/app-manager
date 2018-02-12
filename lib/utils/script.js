// @flow

import type { GetStateType, LoadedScriptType, ScriptType, StatusDetailsType } from '../index';

import { eventTitles } from '../constants';

export default function initScriptFunctions(w: { history: Object }, getState: GetStateType) {
  return function wrapScript(script: LoadedScriptType): ScriptType {
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

          case 6: {
            if (typeof script.hydrate === 'function') {
              await script.hydrate(slotElement);
            } else if (typeof script.render === 'function') {
              await script.render(slotElement);
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

          case 6: {
            if (typeof script.render === 'function') {
              await script.render(slotElement);
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

          case 6: {
            if (typeof script.onStateChange === 'function') {
              await script.onStateChange();
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

          case 6: {
            if (typeof script.unmount === 'function') {
              await script.unmount(slotElement);
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

          case 6: {
            if (typeof script.onUpdateStatus === 'function') {
              await script.onUpdateStatus(statusDetails);
            }

            break;
          }

          default: {
            throw new Error('Script has invalid version.');
          }
        }
      },
    };
  };
}
