// @flow

import { expect } from 'chai';

import { retry } from '../lib/utils/config';

describe('Utils', () => {
  describe('retry', () => {
    it('retries until result returns true', async () => {
      let eventuallyTrue = false;

      setTimeout(() => { eventuallyTrue = true; }, 50);

      const result = await retry(() => eventuallyTrue, 10);

      expect(result).to.be.true;
    });
  });
});
