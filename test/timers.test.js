// @flow

import { expect } from 'chai';

import { retry } from '../lib/utils/timers';

describe('Timers', () => {
  describe('retry', () => {
    it('retries until result returns true', async () => {
      let eventuallyTrue = false;

      setTimeout(() => { eventuallyTrue = true; }, 50);

      const result = await retry(
        () => eventuallyTrue,
        10,
        100,
      );

      expect(result).to.be.true;
    });

    it('returns falsily after timeout if iteratee never returns truth', async () => {
      const result = await retry(
        () => false,
        10,
        100,
      );

      expect(result).to.be.false;
    });
  });
});
