const path = require('path');

module.exports = {
  entry: {
    header: path.join(__dirname, 'src', 'client', 'index.jsx'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'header',
    libraryTarget: 'umd',
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.js', '.jsx'],
    modules: ['node_modules'],
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
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
              ['env', { targets: { browsers: ['>0.25%', 'not ie 11', 'not op_mini all'] } }],
              'react',
            ],
            plugins: ['transform-class-properties', 'transform-runtime'],
          },
        },
      },
    ],
  },
};
