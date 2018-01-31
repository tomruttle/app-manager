// @flow

import express from 'express';

import layout from './layout';

const PORT_NUMBER = 8083;

const app = express();

app.use('/static', express.static('dist'));

app.get('*', (req, res) => {
  const markup = layout(PORT_NUMBER);
  return res.send(markup);
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-guest-react listening on port ${PORT_NUMBER}`);
});
