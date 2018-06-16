// @flow

import AppManagerError from './app-manager-error';
import { levels } from '../constants';

import type { StateType } from '../index';

const errData = {
  source: 'context',
  slot: null,
  fragment: null,
};

const stateContainer = new WeakMap();

export default class Context {
  constructor(initialState?: StateType) {
    if (initialState) {
      this.setState(initialState);
    }
  }

  get state() {
    const state = stateContainer.get(this);

    if (!state) {
      throw new AppManagerError('State has not been set.', {
        ...errData,
        level: levels.ERROR,
        code: 'get_state',
        recoverable: true,
      });
    }

    return state;
  }

  setState(state?: StateType) {
    if (!state) {
      throw new AppManagerError('Attempted to set blank state.', {
        ...errData,
        level: levels.ERROR,
        code: 'set_state',
        recoverable: true,
      });
    }

    stateContainer.set(this, state);

    return state;
  }
}
