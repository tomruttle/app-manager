import React from 'react';

export default function FirstApp({ history, currentApp, action }) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => history.pushState({}, 'Second App', '/second-app')}
      >Click me to switch</button>
    </div>
  );
}
