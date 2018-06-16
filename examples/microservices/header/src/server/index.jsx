// @flow

import express from 'express';
import path from 'path';
import React from 'react';
import ReactDOM from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';

import HeaderApp from '../common/app';

const PORT_NUMBER = 8081;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/app', (req, res) => {
  const { querySelector } = req.query;
  const sheet = new ServerStyleSheet();
  const markup = ReactDOM.renderToString(sheet.collectStyles(<HeaderApp />));
  const styles = sheet.getStyleTags();

  return res.send(/* @html */`
    ${styles}
    <div class="${querySelector.slice(1)}">${markup}</div>
  `);
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-header listening on port ${PORT_NUMBER}`);
});
