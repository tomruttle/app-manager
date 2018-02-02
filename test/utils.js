// @flow

/* eslint-disable import/prefer-default-export */

import type { EventTitleType } from '../lib/index';

export function awaitEvent(appManager: Object, eventTitle: EventTitleType): Promise<void> {
  return new Promise((resolve) => {
    const listener = () => {
      setImmediate(resolve);
      appManager.removeListener(eventTitle, listener);
    };

    appManager.on(eventTitle, listener);
  });
}
