import React from 'react';

export default function FirstApp({ currentApp, action }) {
  return (
    <div>
      <p>This is {currentApp.name}. It has just been {action}</p>
      <button
        onClick={() => window.history.pushState({}, 'Second App', '/second-app')}
      >Click me to switch</button>
    </div>
  );
}
