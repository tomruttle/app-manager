// @flow

import { DEFAULT_TIMEOUT } from '../constants';

export async function delay(timeout: number = DEFAULT_TIMEOUT): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function retry<T>(iteratee: (...Array<mixed>) => ?T, interval: number, timeout: number = DEFAULT_TIMEOUT): Promise<?T> {
  const firstTry = iteratee();

  if (firstTry) {
    return firstTry;
  }

  const retries = timeout / interval;
  let iterations = 0;

  return new Promise((resolve) => {
    const iterator = setInterval(() => {
      iterations += 1;

      const iterateeReturn = iteratee();

      if (iterateeReturn || iterations >= retries) {
        resolve(iterateeReturn);
        clearInterval(iterator);
      }
    }, interval);
  });
}
