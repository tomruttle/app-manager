// @flow

import type { ScriptVersion5Type } from '../../../../../lib/index';

import app from '../common/app';

const firstScript: ScriptVersion5Type = {
  version: 6,

  render: (container, _state) => {
    /* eslint-disable no-param-reassign */
    container.innerHTML = app;
  },
};

export default firstScript;
