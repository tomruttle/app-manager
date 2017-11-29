// @flow

import React from 'react';

import type { FragmentPropsType } from '../../../../es5/index'; 

export default function FirstApp({ history, currentApp, action }: { history: History, currentApp: FragmentPropsType, action: string }) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => history.pushState({}, 'Second App', '/second-app')}
      >Click me to switch</button>
    </div>
  );
}
