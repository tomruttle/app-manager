// @flow

import { expect } from 'chai';

import { delay, retry, setNames, defaultGetRouteNameFromResource, defaultGetElement } from '../lib/utils/config';

describe('config', () => {
  describe('setNames', () => {
    it('adds names to objects', () => {
      const withNames = setNames({ a: {}, b: {} });
      expect(withNames).to.deep.equal({
        a: { name: 'a' },
        b: { name: 'b' },
      });
    });

    it('errors if invalid config is sent', () => {
      try {
        // $ExpectError
        setNames('invalid');
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.code).to.equal('invalid_map');
        expect(err.source).to.equal('set_names');
      }
    });

    it('errors if invalid config items are sent', () => {
      try {
        // $ExpectError
        setNames({ a: 'invalid', b: {} });
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.code).to.equal('invalid_map_item');
        expect(err.source).to.equal('set_names');
      }
    });
  });

  describe('defaultGetRouteNameFromResource', () => {
    it('finds the route name given a resource', () => {
      const getRouteNameFromResource = defaultGetRouteNameFromResource({
        route_a: { name: 'route_a', paths: ['/route-a', '/route-a-2'] },
        route_b: { name: 'route_b', path: '/route-b' },
      });

      const routeName = getRouteNameFromResource('/route-b?test=123');

      expect(routeName).to.equal('route_b');
    });

    it('returns null if no resource given', () => {
      const getRouteNameFromResource = defaultGetRouteNameFromResource({});

      const routeName = getRouteNameFromResource('');

      expect(routeName).to.equal(null);
    });

    it('errors if invalid routes are given', () => {
      try {
        // $ExpectError
        defaultGetRouteNameFromResource('invalid');
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.code).to.equal('invalid_routes');
        expect(err.source).to.equal('default_get_route_name_from_resource');
      }
    });
  });

  describe('delay', () => {
    it('resolves a promise after a time delay', async () => {
      const delayPromise = delay(5);
      expect(delayPromise).to.be.a('Promise');

      const result = await delayPromise;

      expect(result).to.be.undefined;
    });

    it('errors if an invalid timeout is given', async () => {
      try {
        // $ExpectError
        await delay('invalid');
        throw new Error('Should not get hrere.');
      } catch (err) {
        expect(err.source).to.equal('delay');
        expect(err.code).to.equal('invalid_timeout');
      }
    });
  });

  describe('retry', () => {
    it('retries until result returns true', async () => {
      let eventuallyTrue = false;

      setTimeout(() => { eventuallyTrue = true; }, 50);

      const result = await retry(() => eventuallyTrue, 10);

      expect(result).to.be.true;
    });
  });

  describe('defaultGetElement', () => {
    const container = ({ querySelector() { return true; } }: any);

    it('tries to get an element in the window', async () => {
      const element = await defaultGetElement(container, '.test');

      expect(element).to.be.true;
    });

    it('tries to get an element in the window', async () => {
      try {
        // $ExpectError
        await defaultGetElement(container, { invalid: 'test' });
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.code).to.equal('invalid_query_selector');
        expect(err.source).to.equal('get_element');
      }
    });
  });
});
