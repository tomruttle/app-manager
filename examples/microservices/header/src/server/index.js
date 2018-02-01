// @flow

import express from 'express';
import path from 'path';

import layout from './layout';

const PORT_NUMBER = 8081;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/apps/*', (req, res) => {
  const markup = layout();
  return res.send(markup);
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-header listening on port ${PORT_NUMBER}`);
});
