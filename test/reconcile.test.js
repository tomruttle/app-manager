// @flow

import { expect } from 'chai';

import initReconcile from '../lib/utils/reconcile';

describe('reconcile', () => {
  it('mounts the fragments for a route into their slots', () => {
    const config = {
      routes: {
        route_a: { fragment: 'fragment_a' },
      },
      fragments: {
        fragment_a: { slots: ['app'] },
      },
      slots: {
        app: { querySelector: null },
        sidebar: { querySelector: null },
      },
    };

    const reconcile = initReconcile(config);

    const { unmount, mount, update } = reconcile('route_a');

    expect(mount).to.deep.equals({ app: 'fragment_a' });
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({});
  });

  it('updates and unmounts fragments when transitioning from one route to another', () => {
    const config = {
      routes: {
        route_a: { fragments: ['fragment_a', 'fragment_b'] },
        route_b: { fragments: ['fragment_b', 'fragment_c'] },
      },
      fragments: {
        fragment_a: { slots: ['app'] },
        fragment_b: { slots: ['sidebar'] },
        fragment_c: { slot: 'app' },
      },
      slots: {
        app: { querySelector: null },
        sidebar: { querySelector: null },
      },
    };

    const reconcile = initReconcile(config);

    const { unmount, mount, update } = reconcile('route_b', 'route_a');

    expect(mount).to.deep.equals({ app: 'fragment_c' });
    expect(update).to.deep.equals({ sidebar: 'fragment_b' });
    expect(unmount).to.deep.equals({ app: 'fragment_a' });
  });

  it('can handle a route with no fragments', () => {
    const config = {
      routes: {
        route_a: { fragments: ['fragment_a', 'fragment_b'] },
        route_b: {},
      },
      fragments: {
        fragment_a: { slots: ['app'] },
        fragment_b: { slots: ['sidebar'] },
      },
      slots: {
        app: { querySelector: null },
        sidebar: { querySelector: null },
      },
    };

    const reconcile = initReconcile(config);

    const { unmount, mount, update } = reconcile('route_b', 'route_a');

    expect(mount).to.deep.equals({});
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({ app: 'fragment_a', sidebar: 'fragment_b' });
  });

  it('errors if non_existent fragment is listed on a route', () => {
    const config = {
      routes: {
        route_a: { fragment: 'missing' },
      },
      fragments: {},
      slots: {},
    };

    const reconcile = initReconcile(config);

    try {
      reconcile('route_a');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_fragment');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('can hanle a fragment with no slot', () => {
    const config = {
      routes: {
        route_a: { fragment: 'fragment_a' },
      },
      fragments: {
        fragment_a: {},
      },
      slots: {},
    };

    const reconcile = initReconcile(config);

    const { unmount, mount, update } = reconcile('route_a');

    expect(mount).to.deep.equals({});
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({});
  });

  it('errors if slot is missing', () => {
    const config = {
      routes: {
        route_a: { fragment: 'fragment_a' },
      },
      fragments: {
        fragment_a: { slot: 'missing' },
      },
      slots: {},
    };

    const reconcile = initReconcile(config);

    try {
      reconcile('route_a');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('invalid_slots');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('errors if no new route is set', () => {
    const config = {
      routes: {},
      fragments: {},
      slots: {},
    };

    const reconcile = initReconcile(config);

    try {
      reconcile();
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('no_current_route');
      expect(err.source).to.equal('reconcile');
    }
  });

  it('errors if new route is missing', () => {
    const config = {
      routes: {},
      fragments: {},
      slots: {},
    };

    const reconcile = initReconcile(config);

    try {
      reconcile('missing');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_route');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('errors if old route is missing', () => {
    const config = {
      routes: {
        route_a: {},
      },
      fragments: {},
      slots: {},
    };

    const reconcile = initReconcile(config);

    try {
      reconcile('route_a', 'missing');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_route');
      expect(err.source).to.equal('get_page_fragments');
    }
  });
});
