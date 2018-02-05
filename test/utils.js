// @flow

import type { EventTitleType } from '../lib/index';

export function awaitEvent(appManager: Object, eventTitle: EventTitleType): Promise<void> {
  return new Promise((resolve) => {
    const listener = () => {
      resolve();
      appManager.removeListener(eventTitle, listener);
    };

    appManager.on(eventTitle, listener);
  });
}
