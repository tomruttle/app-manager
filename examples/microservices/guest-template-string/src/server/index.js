// @flow

import express from 'express';

import appMarkup from '../common/app';

const PORT_NUMBER = 8084;

const app = express();

app.use('/static', express.static('dist'));

app.get('*', (req, res) => res.send(appMarkup));

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-guest-template-string listening on port ${PORT_NUMBER}`);
});
