// @flow

import express from 'express';
import path from 'path';

import appMarkup from '../common/app';

const PORT_NUMBER = 8084;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/app', (req, res) => res.send(appMarkup));

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-guest-template-string listening on port ${PORT_NUMBER}`);
});
