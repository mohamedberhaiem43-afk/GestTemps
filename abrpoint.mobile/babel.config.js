module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated 4.x délègue les worklets à react-native-worklets ;
    // le plugin doit rester DERNIER pour intercepter correctement les fonctions
    // marquées `worklet` avant les autres transformations.
    plugins: ['react-native-worklets/plugin'],
  };
};