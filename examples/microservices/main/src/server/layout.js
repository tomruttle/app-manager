// @flow

export default function getLayout(renderedMarkup: { [slotName: string]: string }): string {
  return /* @html */`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <link rel="stylesheet" href="/vendor/pure-min.css" integrity="sha384-nn4HPE8lTHyVtfCBi5yW9d20FjT8BJwUXyWZT9InLYax14RDjBj46LmSztkmNP9w" crossorigin="anonymous">
      </head>

      <body>
        <div class="pure-g">
          <div class="pure-u-2-5" style="margin: auto">${renderedMarkup.HEADER}</div>
        </div>

        <div class="pure-g">
          <div class="pure-u-2-5" style="margin: auto">${renderedMarkup.MAIN}</div>
        </div>

        <div class="pure-g">
          <div class="pure-u-1">${renderedMarkup.FOOTER}</div>
        </div>

        <script crossorigin src="/vendor/react.development.js"></script>
        <script crossorigin src="/vendor/react-dom.development.js"></script>

        <script crossorigin src="http://localhost:8081/static/header.js" async></script>
        <script crossorigin src="http://localhost:8082/static/footer.js" async></script>
        <script crossorigin src="http://localhost:8083/static/guest-react.js" async></script>
        <script crossorigin src="http://localhost:8084/static/guest-template-string.js" async></script>

        <script src="/static/main.js"></script>
      </body>
    </html>
  `;
}
