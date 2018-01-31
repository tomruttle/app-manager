// @flow

export default function getLayout(portNumber: string): string {
  return /* @html */`
    <div>

      <script src="http://localhost:${portNumber}/static/header.js"></script>
    </div>
  `;
}
