// @flow

import React from 'react';

import type { AppType } from '../../../../lib/index';

type FirstAppProps = {
  currentApp: AppType,
  action: string,
}

export default function FirstApp({ currentApp, action }: FirstAppProps) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => window.history.pushState({}, 'Second App', '/second-app')}
      >Click me to switch</button>
    </div>
  );
}
