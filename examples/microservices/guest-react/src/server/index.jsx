// @flow

import express from 'express';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';

import GuestReactApp from '../common/app';

const PORT_NUMBER = 8083;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/app/:colour?', (req, res) => {
  const { colour } = req.params;
  const sheet = new ServerStyleSheet();
  const markup = ReactDOM.renderToString(sheet.collectStyles(<GuestReactApp colour={colour} />));
  const styles = sheet.getStyleTags();

  return res.json({ markup, styles });
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-guest-react listening on port ${PORT_NUMBER}`);
});
