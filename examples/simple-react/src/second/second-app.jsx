// @flow

import React from 'react';

export default function SecondApp({ history, currentApp, action }: { history: History, currentApp: GuestPropsType, action: string }) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => history.pushState({}, 'First App', '/')}
      >Click me to switch</button>
    </div>
  );
}
