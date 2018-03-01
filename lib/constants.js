// @flow

export const IMPORT_TIMEOUT = 4000;
export const DOM_CHECK_INTERVAL = 100;

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
  STATUS_CHANGE: `${APP_MANAGER_NAMESPACE}-statuschange`,
  ERROR: `${APP_MANAGER_NAMESPACE}-error`,
  MISSING_SCRIPTS: `${APP_MANAGER_NAMESPACE}-missing-scripts`,
};
