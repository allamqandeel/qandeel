module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its Babel plugin inside react-native-worklets.
    // It must stay last in the plugin list.
    plugins: ['react-native-worklets/plugin'],
  };
};
