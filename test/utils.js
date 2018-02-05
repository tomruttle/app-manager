// @flow

import type { EventTitleType } from '../lib/index';

export function awaitEvent(appManager: Object, eventTitle: EventTitleType): Promise<Array<mixed>> {
  return new Promise((resolve) => {
    const listener = (...args) => {
      resolve(args);
      appManager.removeListener(eventTitle, listener);
    };

    appManager.on(eventTitle, listener);
  });
}
