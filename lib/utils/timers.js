// @flow

export async function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export async function retry<T>(iteratee: (...Array<mixed>) => ?T, interval: number, timeoutMs: number): Promise<?T> {
  const firstTry = iteratee();

  if (firstTry) {
    return firstTry;
  }

  const retries = timeoutMs / interval;
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
