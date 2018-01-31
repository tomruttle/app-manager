// @flow

import express from 'express';

import layout from './layout';

const PORT_NUMBER = 8080;

const app = express();

app.use('/static', express.static('dist'));

app.get('*', (req, res) => {
  const markup = layout();
  return res.send(markup);
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-main listening on port ${PORT_NUMBER}`);
});
