// @flow

import express from 'express';
import path from 'path';

import getSlotsMarkup from './get-slots-markup';

const PORT_NUMBER = 8083;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/app/:colour?', async (req, res, next) => {
  try {
    const slotsMarkup = await getSlotsMarkup(req.originalUrl);
    return res.send(slotsMarkup.APP);
  } catch (err) {
    return next(err);
  }
});

app.listen(PORT_NUMBER, () => {
  /* eslint-disable no-console */
  console.log(`app-manager-examples-microservices-guest-react listening on port ${PORT_NUMBER}`);
});
