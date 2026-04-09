const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Reanimated 4 + Expo 54: default Metro uses `inlineRequires: false`, which breaks Reanimated's
// bundle mode and can cause "[runtime not ready] Exception in HostFunction" at startup.
// See: https://github.com/software-mansion/react-native-reanimated/issues/8904
const { transformer } = config;
config.transformer = {
  ...transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
