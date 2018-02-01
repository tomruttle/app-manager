// @flow

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import AppManagerServer from '../lib/server';

chai.use(chaiAsPromised);

describe('Server', () => {
  function getConfig() {
    return {
      apps: {
        app_a: {
          name: 'app_a',
          fragments: ['fragment_a'],
          appPath: '/app-a',
        },
        app_b: {
          name: 'app_b',
          fragments: ['fragment_b'],
          appPath: '/app-b/:param1?',
        },
      },
      fragments: {
        fragment_a: {
          name: 'fragment_a',
          managed: true,
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          getMarkup: sinon.stub().returns(Promise.resolve('fragment_a')),
        },
        fragment_b: {
          name: 'fragment_b',
          managed: true,
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          getMarkup: sinon.stub().returns(Promise.resolve('fragment_b')),
        },
      },
      slots: {
        app: { name: 'app', querySelector: null },
        other: { name: 'other', querySelector: null },
      },
    };
  }

  describe('init', () => {
    it('rejects if path does not match any apps', () => {
      const appManagerServer = new AppManagerServer(getConfig());
      expect(appManagerServer.init('/app-c')).be.rejectedWith('server.invalid_appPath');
    });

    it('returns the async return value of getMarkup for the correct app in the correct slot', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.init('/app-a');

      expect(appMarkup).to.deep.equals({ app: 'fragment_a', other: '' });

      const getMarkupStubB = config.fragments.fragment_b.getMarkup;
      expect(getMarkupStubB.called).to.be.false;

      const getMarkupStubA = config.fragments.fragment_a.getMarkup;
      expect(getMarkupStubA.calledOnce).to.be.true;

      const args = getMarkupStubA.args[0];
      expect(args).to.be.an('array').with.length(1);
      expect(args[0].app.name).to.equals('app_a');
    });

    it('can handle params, query params, and additional arguments', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.init('/app-b/test', 'query=success', 'additional data');

      expect(appMarkup).to.deep.equals({ app: 'fragment_b', other: '' });

      const getMarkupStubA = config.fragments.fragment_a.getMarkup;
      expect(getMarkupStubA.called).to.be.false;

      const getMarkupStubB = config.fragments.fragment_b.getMarkup;
      expect(getMarkupStubB.calledOnce).to.be.true;

      const args = getMarkupStubB.args[0];
      expect(args).to.be.an('array').with.length(2);
      expect(args[0].app.name).to.equals('app_b');
      expect(args[0].params).to.deep.equals({ param1: 'test' });
      expect(args[0].query).to.deep.equals({ query: 'success' });
      expect(args[1]).to.equals('additional data');
    });
  });
});
