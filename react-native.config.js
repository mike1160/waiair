module.exports = {
  dependencies: {
    // Apple Watch only — Android codegen/compile fails on RN 0.86.3
    'react-native-watch-connectivity': {
      platforms: {
        android: null,
      },
    },
  },
};
