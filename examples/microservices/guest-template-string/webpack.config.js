const path = require('path');

module.exports = {
  entry: {
    'guest-template-string': path.join(__dirname, 'src', 'client', 'index.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'guest-template-string',
    libraryTarget: 'umd',
  },
  devtool: 'inline-source-map',
  resolve: {
    modules: ['node_modules'],
  },
  module: {
    rules: [
      {
        test: /\.js*/,
        exclude: [/node_modules/, /dist/],
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['env', { targets: { browsers: ['last 2 versions'] } }],
              'flow',
            ],
            plugins: ['transform-class-properties', 'transform-runtime'],
          },
        },
      },
    ],
  },
};
