// @flow

import React from 'react';

import type { AppType } from '../../../../lib/index';

type SecondAppProps = {
  currentApp: AppType,
  action: string,
};

export default function SecondApp({ currentApp, action }: SecondAppProps) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>

      <button onClick={() => window.history.pushState({}, 'First App', '/first-app')} >
        Click me to switch
      </button>
    </div>
  );
}
