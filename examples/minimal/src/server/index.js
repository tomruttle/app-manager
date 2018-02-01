const express = require('express');
const path = require('path');

const { default: AppManagerServer } = require('../../../../es5/server');
const config = require('../common/config');

const app = express();

const appManagerServer = new AppManagerServer(config);

app.use('/static', express.static(path.join(__dirname, '..', '..', 'dist')));

app.get('/apps/*', async (req, res) => {
  const renderedMarkup = await appManagerServer.init(req.originalUrl);

  return res.send(/* @html */`
    <!DOCTYPE html>
    <html>
      <body>
        ${renderedMarkup.APP}
        <script src="/static/main.js"></script>
      </body>
    </html>
  `);
});

app.listen(8090, () => { console.log('app listening on port 8090'); });
