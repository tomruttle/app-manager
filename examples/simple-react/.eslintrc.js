module.exports = {
  extends: ['airbnb', 'plugin:flowtype/recommended'],
  parser: 'babel-eslint',
  plugins: ['flowtype'],
  settings: {
    'import/resolver': 'webpack',
  },
  rules: {
    'no-console': 2,
    'id-length': 0,
    'max-len': 0,
    'no-underscore-dangle': 0,
    'import/extensions': 0,
    'arrow-parens': ['error', 'always'],
  },
};
