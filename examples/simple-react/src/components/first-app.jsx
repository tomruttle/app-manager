// @flow

import React from 'react';

import SwitcherButton from './switcher-button';

export default function FirstApp() {
  return (
    <div>
      <p>This is First App.</p>

      <SwitcherButton appName="Second App" appPath="/second-app" />
    </div>
  );
}
