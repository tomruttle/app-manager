module.exports = {
  "apps": [
    {
      "name": "main",
      "script": "./main",
      "watch": true,
      "exec_interpreter": "./main/node_modules/.bin/babel-node"
    },
    {
      "name": "header",
      "script": "./header",
      "watch": true,
      "exec_interpreter": "./header/node_modules/.bin/babel-node",
    },
    {
      "name": "footer",
      "script": "./footer",
      "watch": true,
      "exec_interpreter": "./footer/node_modules/.bin/babel-node",
    },
    {
      "name": "guest-react",
      "script": "./guest-react",
      "watch": true,
      "exec_interpreter": "./guest-react/node_modules/.bin/babel-node",
    },
    {
      "name": "guest-template-string",
      "script": "./guest-template-string",
      "watch": true,
      "exec_interpreter": "./guest-template-string/node_modules/.bin/babel-node",
    }
  ]
}
