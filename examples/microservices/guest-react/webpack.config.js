const path = require('path');

module.exports = {
  entry: {
    'guest-react': path.join(__dirname, 'src', 'client', 'index.jsx'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.js', '.jsx'],
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
              'react',
            ],
            plugins: ['transform-class-properties', 'transform-runtime'],
          },
        },
      },
    ],
  },
};
