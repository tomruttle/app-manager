const path = require('path');

module.exports = {
  entry: {
    main: path.join(__dirname, 'src', 'client', 'index.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'handleClick',
    libraryTarget: 'umd',
  },
};
