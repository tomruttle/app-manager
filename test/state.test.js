// @flow

import { expect } from 'chai';

import initUpdateState from '../lib/utils/state';

describe('Update state', () => {
  const routes = { ROUTE: { name: 'ROUTE' } };

  const options = {
    importTimeout: 10,
    async getElement() { return null; },
    async getRouteNameFromResource() { return 'ROUTE'; },
    async getAdditionalState() { return { additional: 'state' }; },
  };

  const updateState = initUpdateState(routes, options);

  it('returns null if route not found.', async () => {
    const browserState = { resource: '/path' };

    const nullOptions = {
      importTimeout: 10,
      async getElement() { return null; },
      async getRouteNameFromResource() { return null; },
    };

    const nullUpdateState = initUpdateState(routes, nullOptions);

    const state = await nullUpdateState(browserState);

    expect(state).to.be.null;
  });

  it('returns null if routeName not in provided routes.', async () => {
    const browserState = { resource: '/path' };

    const nullOptions = {
      importTimeout: 10,
      async getElement() { return null; },
      async getRouteNameFromResource() { return 'missing-route'; },
    };

    const nullUpdateState = initUpdateState(routes, nullOptions);

    const state = await nullUpdateState(browserState);

    expect(state).to.be.null;
  });

  it('returns new state.', async () => {
    const browserState = { resource: '/path', eventTitle: 'am-replaceState' };

    const state = await updateState(browserState);

    expect(state).to.deep.equal({
      event: 'am-replaceState',
      resource: '/path',
      prevRoute: null,
      route: { name: 'ROUTE' },
      additional: 'state',
    });
  });
});
