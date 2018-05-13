// @flow

import { expect } from 'chai';

import getPathHelpers from '../lib/utils/path';

describe('Path Helpers', () => {
  describe('getPathHelpers', () => {
    it('fails if no routes are specified.', () => {
      try {
        // $ExpectError
        getPathHelpers();
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.message).to.not.include('Should not get here.');
      }
    });

    it('fails if no routes with paths are specified.', () => {
      try {
        getPathHelpers({ APP: {}, OTHER: {} });
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.message).to.not.include('Should not get here.');
      }
    });
  });

  describe('getRouteNameFromResource', () => {
    const routes = {
      APP: { paths: ['/path/:id/:otherParam(valid|options)/:optional?', '/path/:otherParam(valid|options)/:optional?'] },
      OTHER: { path: '/not-path/:id/:optional?' },
    };

    const { getRouteNameFromResource } = getPathHelpers(routes);

    it('Finds a route from its path', () => {
      const routeName = getRouteNameFromResource('/path/1058690/valid/optional');
      expect(routeName).to.equals('APP');
    });

    it('Returns undefined if no urls match', () => {
      const routeName = getRouteNameFromResource('/path/1058690/invalid/optional');
      expect(routeName).to.be.undefined;
    });
  });

  describe('getAdditionalState', () => {
    const routes = { APP: { paths: ['/path/:id/:otherParam(valid|options)/:optional?', '/not-path/:id/:optional?'] } };

    const { getAdditionalState } = getPathHelpers(routes);

    it('finds params from route', () => {
      const { params } = getAdditionalState('APP', '/path/1058690/valid/optional');
      expect(params).to.deep.equals({
        id: '1058690',
        otherParam: 'valid',
        optional: 'optional',
      });
    });

    it('handles optional params from route', () => {
      const { params, query } = getAdditionalState('APP', '/path/1058690/valid');
      expect(params).to.deep.equals({
        id: '1058690',
        otherParam: 'valid',
        optional: undefined,
      });
      expect(query).to.be.an('object').that.is.empty;
    });

    it('handles invalid routes', () => {
      const { params } = getAdditionalState('APP', '/invalid/1058690/valid');
      expect(params).to.be.an('object').that.is.empty;
    });

    it('handles invalid params', () => {
      const { params } = getAdditionalState('APP', '/path/1058690/invalid/abcde');
      expect(params).to.be.an('object').that.is.empty;
    });

    it('parses queries', () => {
      const { params, query } = getAdditionalState('APP', '/path/1058690/valid?test=true');
      expect(params).to.deep.equals({
        id: '1058690',
        otherParam: 'valid',
        optional: undefined,
      });
      expect(query).to.deep.equals({ test: 'true' });
    });
  });
});
