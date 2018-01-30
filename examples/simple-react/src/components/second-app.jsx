// @flow

import React from 'react';

import SwitcherButton from './switcher-button';

export default function SecondApp() {
  return (
    <div>
      <p>This is Second App.</p>

      <SwitcherButton appName="First App" appPath="/first-app" />
    </div>
  );
}
