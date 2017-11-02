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
  devServer: {
    open: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'My App',
      template: 'src/template.html',
      inject: true,
    }),
  ],
};
