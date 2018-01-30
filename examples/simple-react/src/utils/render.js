// @flow

import ReactDOM from 'react-dom';

export default function render(app: React$Element<*>, container?: Element): Promise<?void> {
  return new Promise((resolve, reject) => {
    if (!container) {
      return reject(new Error('Container not provided.'));
    }

    ReactDOM.render(app, container, (err) => (err ? reject(err) : resolve()));
    return null;
  });
}
