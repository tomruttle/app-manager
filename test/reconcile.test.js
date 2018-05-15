// @flow

import { expect } from 'chai';

import initReconcile from '../lib/reconcile';
import initGetPageFragments from '../lib/fragments';

describe('reconcile', () => {
  it('mounts the fragments for a route into their slots', () => {
    const routes = {
      route_a: { name: 'route_a', fragment: 'fragment_a' },
    };

    const fragments = {
      fragment_a: { name: 'fragment_a', slots: ['app'] },
    };

    const slots = {
      app: { name: 'app', querySelector: null },
      sidebar: { name: 'sidebar', querySelector: null },
    };

    const getPageFragments = initGetPageFragments(slots, fragments, routes);
    const reconcile = initReconcile(getPageFragments);

    const { unmount, mount, update } = reconcile('route_a');

    expect(mount).to.deep.equals({ app: 'fragment_a' });
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({});
  });

  it('updates and unmounts fragments when transitioning from one route to another', () => {
    const routes = {
      route_a: { name: 'route_a', fragments: ['fragment_a', 'fragment_b'] },
      route_b: { name: 'route_b', fragments: ['fragment_b', 'fragment_c'] },
    };

    const fragments = {
      fragment_a: { name: 'fragment_a', slots: ['app'] },
      fragment_b: { name: 'fragment_b', slots: ['sidebar'] },
      fragment_c: { name: 'fragment_c', slot: 'app' },
    };

    const slots = {
      app: { name: 'app', querySelector: null },
      sidebar: { name: 'sidebar', querySelector: null },
    };

    const getPageFragments = initGetPageFragments(slots, fragments, routes);
    const reconcile = initReconcile(getPageFragments);

    const { unmount, mount, update } = reconcile('route_b', 'route_a');

    expect(mount).to.deep.equals({ app: 'fragment_c' });
    expect(update).to.deep.equals({ sidebar: 'fragment_b' });
    expect(unmount).to.deep.equals({ app: 'fragment_a' });
  });

  it('can handle a route with no fragments', () => {
    const routes = {
      route_a: { name: 'route_a', fragments: ['fragment_a', 'fragment_b'] },
      route_b: { name: 'route_b' },
    };

    const fragments = {
      fragment_a: { name: 'fragment_a', slots: ['app'] },
      fragment_b: { name: 'fragment_b', slots: ['sidebar'] },
    };

    const slots = {
      app: { name: 'app', querySelector: null },
      sidebar: { name: 'sidebar', querySelector: null },
    };

    const getPageFragments = initGetPageFragments(slots, fragments, routes);
    const reconcile = initReconcile(getPageFragments);

    const { unmount, mount, update } = reconcile('route_b', 'route_a');

    expect(mount).to.deep.equals({});
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({ app: 'fragment_a', sidebar: 'fragment_b' });
  });

  it('errors if non_existent fragment is listed on a route', () => {
    const routes = {
      route_a: { name: 'route_a', fragment: 'missing' },
    };

    const getPageFragments = initGetPageFragments({}, {}, routes);
    const reconcile = initReconcile(getPageFragments);

    try {
      reconcile('route_a');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_fragment');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('can hanle a fragment with no slot', () => {
    const routes = {
      route_a: { name: 'route_a', fragment: 'fragment_a' },
    };

    const fragments = {
      fragment_a: { name: 'fragment_a' },
    };

    const getPageFragments = initGetPageFragments({}, fragments, routes);
    const reconcile = initReconcile(getPageFragments);

    const { unmount, mount, update } = reconcile('route_a');

    expect(mount).to.deep.equals({});
    expect(update).to.deep.equals({});
    expect(unmount).to.deep.equals({});
  });

  it('errors if slot is missing', () => {
    const routes = {
      route_a: { name: 'route_a', fragment: 'fragment_a' },
    };

    const fragments = {
      fragment_a: { name: 'fragment_a', slot: 'missing' },
    };

    const getPageFragments = initGetPageFragments({}, fragments, routes);
    const reconcile = initReconcile(getPageFragments);

    try {
      reconcile('route_a');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('invalid_slots');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('errors if no new route is set', () => {
    const getPageFragments = initGetPageFragments({}, {}, {});
    const reconcile = initReconcile(getPageFragments);

    try {
      reconcile();
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('no_current_route');
      expect(err.source).to.equal('reconcile');
    }
  });

  it('errors if new route is missing', () => {
    const getPageFragments = initGetPageFragments({}, {}, {});
    const reconcile = initReconcile(getPageFragments);

    try {
      reconcile('missing');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_route');
      expect(err.source).to.equal('get_page_fragments');
    }
  });

  it('errors if old route is missing', () => {
    const routes = {
      route_a: { name: 'route_a' },
    };

    const getPageFragments = initGetPageFragments({}, {}, routes);
    const reconcile = initReconcile(getPageFragments);

    try {
      reconcile('route_a', 'missing');
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.code).to.equal('missing_route');
      expect(err.source).to.equal('get_page_fragments');
    }
  });
});
