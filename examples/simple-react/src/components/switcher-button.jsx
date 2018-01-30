// @flow

import React from 'react';

type SwitcherButtonProps = {
  appName: string,
  appPath: string,
}

export default function SwitcherButton({ appName, appPath }: SwitcherButtonProps) {
  return (
    <button onClick={() => window.history.pushState({}, appName, appPath)} >
      Click me to switch to {appName}.
    </button>
  );
}
