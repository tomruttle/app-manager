// @flow

import { expect } from 'chai';

import initUpdateState from '../lib/state';

describe('Update state', () => {
  const routes = { ROUTE: { name: 'ROUTE' } };

  async function getRouteNameFromResource() {
    return 'ROUTE';
  }

  async function getAdditionalState() {
    return { additional: 'state' };
  }

  const updateState = initUpdateState(routes, getRouteNameFromResource, getAdditionalState);

  it('returns null if route not found.', async () => {
    const currentState = {
      resource: '/path',
      route: null,
      prevRoute: null,
      eventTitle: 'hc-initialise',
    };

    const nullUpdateState = initUpdateState(routes, () => null);

    const state = await nullUpdateState(currentState);

    expect(state).to.deep.equals(currentState);
  });

  it('returns null if routeName not in provided routes.', async () => {
    const currentState = {
      resource: '/path',
      route: null,
      prevRoute: null,
      eventTitle: 'hc-initialise',
    };

    const nullUpdateState = initUpdateState(routes, () => 'missing-route');

    const state = await nullUpdateState(currentState);

    expect(state).to.deep.equals(currentState);
  });

  it('returns new state.', async () => {
    const currentState = {
      resource: '/path',
      route: null,
      prevRoute: null,
      eventTitle: 'am-replaceState',
    };

    const state = await updateState(currentState);

    expect(state).to.deep.equal({
      eventTitle: 'am-replaceState',
      resource: '/path',
      prevRoute: null,
      route: { name: 'ROUTE' },
      additional: 'state',
    });
  });
});
