module.exports = {
  'presets': ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
  'plugins': [
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-optional-chaining',
  ],
  'ignore': ['**/*.usfm.js'],
};
