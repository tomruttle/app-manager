// @flow

import React from 'react';

import type { FragmentPropsType } from '../../../../es5/index';

export default function SecondApp({ history, currentApp, action }: { history: HistoryType, currentApp: FragmentPropsType, action: string }) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => history.pushState({}, 'First App', '/')}
      >Click me to switch</button>
    </div>
  );
}
