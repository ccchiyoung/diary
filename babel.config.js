module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin must be listed last (used by reanimated 4 / skia)
    plugins: ['react-native-worklets/plugin'],
  };
};
