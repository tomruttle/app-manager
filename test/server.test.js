// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import AppManagerServer from '../lib/server';

describe('Server', () => {
  function getConfig() {
    return {
      routes: {
        app_a: {
          fragments: ['fragment_a'],
          path: '/app-a',
        },
        app_b: {
          fragments: ['fragment_b'],
          path: '/app-b',
        },
        app_c: {
          fragments: ['fragment_c'],
          path: '/app-c',
        },
      },
      fragments: {
        fragment_a: {
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          ssrGetMarkup: sinon.stub().returns(Promise.resolve('fragment_a')),
        },
        fragment_b: {
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          ssrGetMarkup: sinon.stub().returns(Promise.resolve('fragment_b')),
        },
        fragment_c: {
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
        },
      },
      slots: {
        app: { querySelector: '.app' },
        other: { querySelector: '.other' },
      },
    };
  }

  describe('getSlotsMarkup', () => {
    it('rejects if path does not match any routes', async () => {
      const appManagerServer = new AppManagerServer(getConfig());

      try {
        await appManagerServer.getSlotsMarkup('/app-d');
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.source).to.equal('get_slots_markup');
        expect(err.code).to.equal('invalid_route');
      }
    });

    it('returns the async return value of ssrGetMarkup for the correct fragment in the correct slot', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.getSlotsMarkup('/app-a');

      expect(appMarkup).to.deep.equals({ app: 'fragment_a' });

      const ssrGetMarkupStubB = config.fragments.fragment_b.ssrGetMarkup;
      expect(ssrGetMarkupStubB.called).to.be.false;

      const ssrGetMarkupStubA = config.fragments.fragment_a.ssrGetMarkup;
      expect(ssrGetMarkupStubA.calledOnce).to.be.true;

      const args = ssrGetMarkupStubA.args[0];
      expect(args).to.be.an('array').with.length(2);
      expect(args[0]).to.equals('.app');
      expect(args[1].route.name).to.equals('app_a');
    });

    it('can handle additional arguments', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.getSlotsMarkup('/app-b?query=success', 'additional data');

      expect(appMarkup).to.deep.equals({ app: 'fragment_b' });

      const ssrGetMarkupStubA = config.fragments.fragment_a.ssrGetMarkup;
      expect(ssrGetMarkupStubA.called).to.be.false;

      const ssrGetMarkupStubB = config.fragments.fragment_b.ssrGetMarkup;
      expect(ssrGetMarkupStubB.calledOnce).to.be.true;

      const args = ssrGetMarkupStubB.args[0];
      expect(args).to.be.an('array').with.length(3);
      expect(args[0]).to.equal('.app');
      expect(args[1].route.name).to.equals('app_b');
      expect(args[2]).to.equals('additional data');
    });

    it('can handle fragments without ssrGetMarkup', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.getSlotsMarkup('/app-c');

      expect(appMarkup).to.deep.equals({ app: '' });
    });
  });
});
