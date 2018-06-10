// @flow

import { expect } from 'chai';

import { eventTitles } from '../lib/constants';
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
      rootState: true,
      resource: '/path',
      eventTitle: eventTitles.INITIALISE,
      historyState: null,
      title: null,
    };

    const nullUpdateState = initUpdateState(routes, () => null);

    const state = await nullUpdateState(currentState);

    expect(state).to.be.null;
  });

  it('returns null if routeName not in provided routes.', async () => {
    const currentState = {
      rootState: true,
      resource: '/path',
      eventTitle: eventTitles.INITIALISE,
      historyState: null,
      title: null,
    };

    const nullUpdateState = initUpdateState(routes, () => 'missing-route');

    const state = await nullUpdateState(currentState);

    expect(state).to.be.null;
  });

  it('returns new state.', async () => {
    const currentState = {
      rootState: true,
      resource: '/path',
      eventTitle: eventTitles.HISTORY_REPLACE_STATE,
      historyState: null,
      title: null,
    };

    const state = await updateState(currentState);

    expect(state).to.deep.equal({
      eventTitle: eventTitles.HISTORY_REPLACE_STATE,
      resource: '/path',
      prevRoute: null,
      route: { name: 'ROUTE' },
      additional: 'state',
      historyState: null,
      title: null,
    });
  });
});
