module.exports = {
  extends: ['airbnb'],
  parser: 'babel-eslint',
  env: {
    browser: true,
  },
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
    'no-unused-vars': ["error", { "argsIgnorePattern": "^_" }]
  },
};
