// @flow

import express from 'express';
import path from 'path';

import AppManagerServer from '../../../../../lib/server';

import config from '../common/config';
import layout from './layout';

const PORT_NUMBER = 8080;

const app = express();

const appManagerServer = new AppManagerServer(config);

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/apps/*', async (req, res) => {
  const renderedMarkup = await appManagerServer.init(req.originalUrl);
  const markup = layout(renderedMarkup);
  return res.send(markup);
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-main listening on port ${PORT_NUMBER}`);
});
