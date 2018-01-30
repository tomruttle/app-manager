const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'simple-react': path.join(__dirname, 'src', 'index.js'),
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
  devServer: {
    open: true,
  },
  node: {
    console: true,
  },
  module: {
    rules: [
      {
        test: /\.js*/,
        exclude: [/node_modules/, /dist/],
        use: {
          loader: 'babel-loader',
          options: { presets: ['react'] },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/template.html',
      inject: true,
    }),
  ],
};
