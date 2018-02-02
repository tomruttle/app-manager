// @flow

import type { StatusLevelType } from '../index';

type AmErrorPropsType = {|
  code?: string,
  source?: string,
  id?: string,
  path?: string,
  level?: StatusLevelType,
|};

export default class AppManagerError extends Error {
  isAmError: boolean;
  source: ?string;
  code: ?string;
  id: ?string;
  path: ?string;
  level: ?string;

  constructor(err: string | Error, amErrorProps: AmErrorPropsType) {
    const message = err instanceof Error ? err.message : err;

    super(message);

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(err instanceof Error ? err : this, AppManagerError);
    } else {
      this.stack = (err instanceof Error ? err : new Error(message)).stack;
    }

    const {
      source,
      code,
      id,
      path,
      level,
    } = amErrorProps;

    this.level = err instanceof AppManagerError && err.level ? err.level : level;
    this.source = err instanceof AppManagerError && err.source ? err.source : source;
    this.code = err instanceof AppManagerError && err.code ? err.code : code;
    this.id = err instanceof AppManagerError && err.id ? err.id : id;
    this.path = err instanceof AppManagerError && err.path ? err.path : path;

    this.isAmError = true;
  }
}
