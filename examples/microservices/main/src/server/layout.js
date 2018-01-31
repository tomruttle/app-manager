// @flow

export default function getLayout(): string {
  return /* @html */`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <link rel="stylesheet" href="https://unpkg.com/purecss@1.0.0/build/pure-min.css" integrity="sha384-nn4HPE8lTHyVtfCBi5yW9d20FjT8BJwUXyWZT9InLYax14RDjBj46LmSztkmNP9w" crossorigin="anonymous">
      </head>

      <body>
        <div class="pure-g">
          <div class="pure-u-1-3"></div>
          <div class="pure-u-1-3 header-slot"></div>
          <div class="pure-u-1-3"></div>
        </div>

        <div class="pure-g">
          <div class="pure-u-1-3"></div>
          <div class="pure-u-1-3 app-slot"></div>
          <div class="pure-u-1-3"></div>
        </div>

        <div class="pure-g">
          <div class="pure-u-1-3"></div>
          <div class="pure-u footer-slot"></div>
          <div class="pure-u-1-3"></div>
        </div>

        <script src="http://localhost:8081/static/header.js"></script>
        <script src="http://localhost:8082/static/footer.js"></script>
        <script src="http://localhost:8083/static/guest-react.js"></script>
        <script src="http://localhost:8084/static/guest-template-string.js"></script>

        <script src="http://localhost:8080/static/main.js"></script>
      </body>
    </html>
  `;
}
