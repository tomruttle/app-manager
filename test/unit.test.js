// @flow

import { expect } from 'chai';

import initAppManager from '../lib/app-manager';
import WindowStub from '../lib/utils/window-stub';

describe('Retry', () => {
  const windowStub = new WindowStub();
  const AppManager = initAppManager(windowStub);

  it('retries until result returns true', async () => {
    let eventuallyTrue = false;

    setTimeout(() => { eventuallyTrue = true; }, 50);

    const result = await AppManager._retry(
      () => eventuallyTrue,
      100,
      10,
    );

    expect(result).to.be.true;
  });

  it('returns falsily after timeout if iteratee never returns truth', async () => {
    const result = await AppManager._retry(
      () => false,
      100,
      10,
    );

    expect(result).to.be.false;
  });
});
