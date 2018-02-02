// @flow

type AmErrorPropsType = {
  type?: string,
  source?: string,
  id?: string,
  path?: string,
};

export default class AppManagerError extends Error {
  isAmError: boolean;
  source: ?string;
  type: ?string;
  id: ?string;
  path: ?string;

  constructor(err: string | Error, amErrorProps?: AmErrorPropsType = {}) {
    const message = err instanceof Error ? err.message : err;

    super(message);

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(err instanceof Error ? err : this, AppManagerError);
    } else {
      this.stack = (err instanceof Error ? err : new Error(message)).stack;
    }

    const {
      source,
      type,
      id,
      path,
    } = amErrorProps;

    this.source = err instanceof AppManagerError && err.source ? err.source : source;
    this.type = err instanceof AppManagerError && err.type ? err.type : type;
    this.id = err instanceof AppManagerError && err.id ? err.id : id;
    this.path = err instanceof AppManagerError && err.path ? err.path : path;

    this.isAmError = true;
  }
}
