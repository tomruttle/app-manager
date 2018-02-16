// @flow

import { expect } from 'chai';

import getPathHelpers from '../lib/utils/path';

describe('Path Helpers', () => {
  describe('getAppNameFromResource', () => {
    const apps = {
      APP: { appPaths: ['/path/:id/:otherParam(valid|options)/:optional?', '/path/:otherParam(valid|options)/:optional?'] },
      OTHER: { appPath: '/not-path/:id/:optional?' },
    };

    const { getAppNameFromResource } = getPathHelpers(apps);

    it('Finds an app from its path', () => {
      const appName = getAppNameFromResource('/path/1058690/valid/optional');
      expect(appName).to.equals('APP');
    });

    it('Returns undefined if no urls match', () => {
      const appName = getAppNameFromResource('/path/1058690/invalid/optional');
      expect(appName).to.be.undefined;
    });
  });

  describe('getAdditionalState', () => {
    const apps = { APP: { appPaths: ['/path/:id/:otherParam(valid|options)/:optional?'] } };

    const { getAdditionalState } = getPathHelpers(apps);

    it('finds params from appRoute', () => {
      const { params } = getAdditionalState('APP', '/path/1058690/valid/optional');
      expect(params).to.deep.equals({
        id: '1058690',
        otherParam: 'valid',
        optional: 'optional',
      });
    });

    it('handles optional params from appRoute', () => {
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
