const path = require('path');

module.exports = {
  entry: path.join(__dirname, 'es5', 'index.js'),
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'app-manager.js',
    library: 'AppManager',
    libraryTarget: 'umd',
  },
};
