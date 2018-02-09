// @flow

import type {
  AppNameType,
  FragmentNameType,
  SlotNameType,
  StatusLevelType,
} from '../index';

type AmErrorPropsType = {|
  code: string,
  source: string,
  level: StatusLevelType,
  recoverable: boolean,
  path: ?string,
  slot: ?SlotNameType,
  fragment: ?FragmentNameType,
  app: ?AppNameType,
|};

export default class AppManagerError extends Error {
  code: string;
  source: string;
  level: StatusLevelType;
  recoverable: boolean;
  path: ?string;
  slot: ?SlotNameType;
  fragment: ?FragmentNameType;
  app: ?AppNameType;
  isAmError: boolean;

  constructor(err: string | Error, props: AmErrorPropsType) {
    const message = err instanceof Error ? err.message : err;

    super(message);

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (err instanceof Error ? err : new Error(message)).stack;
    }

    Object.keys(props).forEach((key) => {
      // $FlowFixMe
      this[key] = err instanceof AppManagerError && err[key] ? err[key] : props[key];
    });

    this.isAmError = true;
  }
}
