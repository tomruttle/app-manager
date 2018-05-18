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
    const browserState = { resource: '/path' };

    const nullUpdateState = initUpdateState(routes, () => null);

    const state = await nullUpdateState(browserState);

    expect(state).to.be.null;
  });

  it('returns null if routeName not in provided routes.', async () => {
    const browserState = { resource: '/path' };

    const nullUpdateState = initUpdateState(routes, () => 'missing-route');

    const state = await nullUpdateState(browserState);

    expect(state).to.be.null;
  });

  it('returns new state.', async () => {
    const browserState = { resource: '/path', eventTitle: 'am-replaceState' };

    const state = await updateState(browserState);

    expect(state).to.deep.equal({
      eventTitle: 'am-replaceState',
      resource: '/path',
      prevRoute: null,
      route: { name: 'ROUTE' },
      additional: 'state',
    });
  });
});
