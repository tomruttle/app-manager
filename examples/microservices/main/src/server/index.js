// @flow

import express from 'express';
import path from 'path';

import appManagerServer from '../../../../../lib/server';

import config, { options } from '../common/config';
import layout from './layout';

const PORT_NUMBER = 8080;

const app = express();

const { getSlotsMarkup } = appManagerServer(config, options);

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));
app.use('/vendor', express.static(path.join(__dirname, '..', '..', 'vendor')));

app.get('/apps/*', async (req, res, next) => {
  try {
    const renderedMarkup = await getSlotsMarkup(req.originalUrl);
    const markup = layout(renderedMarkup);
    return res.send(markup);
  } catch (err) {
    return next(err);
  }
});

app.get('/external', async (req, res) => res.send(`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">

      <link rel="stylesheet" href="/vendor/pure-min.css" integrity="sha384-nn4HPE8lTHyVtfCBi5yW9d20FjT8BJwUXyWZT9InLYax14RDjBj46LmSztkmNP9w" crossorigin="anonymous">
    </head>

    <body>
      <div>
        <p>This is a view not managed by app-manager</p>
      </div>
    </body>
  </html>
`));

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-main listening on port ${PORT_NUMBER}`);
});
