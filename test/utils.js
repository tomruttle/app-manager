// @flow

export function awaitEvent(eventEmitter: Object, eventTitle: string): Promise<Array<mixed>> {
  return new Promise((resolve) => {
    const listener = (...args) => {
      resolve(args);
      eventEmitter.removeListener(eventTitle, listener);
    };

    eventEmitter.on(eventTitle, listener);
  });
}
