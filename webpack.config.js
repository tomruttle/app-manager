const path = require('path');

const SUPPORTED_BROWSERS = ['last 2 versions', 'ie 9', 'ie 10'];

module.exports = (env) => ({
  entry: {
    'app-manager': path.join(__dirname, 'lib', 'index.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'app-manager',
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
            plugins: ['transform-class-properties'],
          },
        },
      },
    ],
  },
});
