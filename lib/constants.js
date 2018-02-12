// @flow

export const IMPORT_TIMEOUT = 4000;
export const DOM_CHECK_INTERVAL = 100;
export const AM_STATE_KEY = 'appManagerState';

const APP_MANAGER_NAMESPACE = 'am';

export const statuses = {
  DEFAULT: 'DEFAULT',
  LOADING: 'LOADING',
  ERROR: 'ERROR',
  UNINITIALISED: 'UNINITIALISED',
};

export const levels = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

export const eventTitles = {
  WINDOW_BEFORE_UNLOAD: `${APP_MANAGER_NAMESPACE}-beforeunload`,
  HISTORY_POP_STATE: `${APP_MANAGER_NAMESPACE}-popstate`,
  HISTORY_REPLACE_STATE: `${APP_MANAGER_NAMESPACE}-replacestate`,
  HISTORY_PUSH_STATE: `${APP_MANAGER_NAMESPACE}-pushstate`,
  HISTORY_STATE_CHANGE: `${APP_MANAGER_NAMESPACE}-statechange`,
  STATUS_CHANGE: `${APP_MANAGER_NAMESPACE}-statuschange`,
  ERROR: `${APP_MANAGER_NAMESPACE}-error`,
  EXTERNAL_LINK: `${APP_MANAGER_NAMESPACE}-external-link`,
};
