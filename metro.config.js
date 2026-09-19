const { getDefaultConfig } = require('expo/metro-config');

/**
 * Default Expo config. expo-asset is NOT stubbed: with expo-updates it is what maps a bundled image or video to
 * the copy an OTA update downloaded. A JS stub here made every bundled asset (Kids mode's videos and artwork,
 * logos, the sky) resolve to a path that does not exist once an update was running.
 */
module.exports = getDefaultConfig(__dirname);
