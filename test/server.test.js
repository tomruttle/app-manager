// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import AppManagerServer from '../lib/server';

describe('Server', () => {
  function getConfig() {
    return {
      apps: {
        app_a: {
          fragments: ['fragment_a'],
          appPath: '/app-a',
        },
        app_b: {
          fragments: ['fragment_b'],
          appPath: '/app-b',
        },
      },
      fragments: {
        fragment_a: {
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          getMarkup: sinon.stub().returns(Promise.resolve('fragment_a')),
        },
        fragment_b: {
          slots: ['app'],
          loadScript: () => { throw new Error('Should not be called.'); },
          getMarkup: sinon.stub().returns(Promise.resolve('fragment_b')),
        },
      },
      slots: {
        app: { querySelector: null },
        other: { querySelector: null },
      },
    };
  }

  describe('getSlotsMarkup', () => {
    it('rejects if path does not match any apps', async () => {
      const appManagerServer = new AppManagerServer(getConfig());

      try {
        await appManagerServer.getSlotsMarkup('/app-c');
        throw new Error('Should not get here.');
      } catch (err) {
        expect(err.source).to.equal('get_slots_markup');
        expect(err.code).to.equal('invalid_route');
        expect(err.path).to.equal('/app-c');
      }
    });

    it('returns the async return value of getMarkup for the correct app in the correct slot', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.getSlotsMarkup('/app-a');

      expect(appMarkup).to.deep.equals({ app: 'fragment_a', other: '' });

      const getMarkupStubB = config.fragments.fragment_b.getMarkup;
      expect(getMarkupStubB.called).to.be.false;

      const getMarkupStubA = config.fragments.fragment_a.getMarkup;
      expect(getMarkupStubA.calledOnce).to.be.true;

      const args = getMarkupStubA.args[0];
      expect(args).to.be.an('array').with.length(1);
      expect(args[0].app.name).to.equals('app_a');
    });

    it('can handle additional arguments', async () => {
      const config = getConfig();
      const appManagerServer = new AppManagerServer(config);
      const appMarkup = await appManagerServer.getSlotsMarkup('/app-b', 'query=success', 'additional data');

      expect(appMarkup).to.deep.equals({ app: 'fragment_b', other: '' });

      const getMarkupStubA = config.fragments.fragment_a.getMarkup;
      expect(getMarkupStubA.called).to.be.false;

      const getMarkupStubB = config.fragments.fragment_b.getMarkup;
      expect(getMarkupStubB.calledOnce).to.be.true;

      const args = getMarkupStubB.args[0];
      expect(args).to.be.an('array').with.length(2);
      expect(args[0].app.name).to.equals('app_b');
      expect(args[1]).to.equals('additional data');
    });
  });
});
