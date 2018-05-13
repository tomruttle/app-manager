const path = require('path');

const SUPPORTED_BROWSERS = ['>0.25%', 'not ie 11', 'not op_mini all'];

module.exports = (env) => ({
  entry: {
    'app-manager': ['babel-polyfill', path.join(__dirname, 'lib', 'index.js')],
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'AppManager',
    libraryTarget: 'umd',
  },
  devtool: !env === 'prod' ? 'inline-source-map' : false,
  node: {
    console: true,
  },
  module: {
    rules: [
      {
        test: /\.js/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['env', { loose: true, modules: false, targets: { browsers: SUPPORTED_BROWSERS } }],
              'flow',
            ],
            plugins: ['transform-async-generator-functions', 'transform-class-properties', ['transform-builtin-extend', { globals: ['Error'] }]],
          },
        },
      },
    ],
  },
});
