const DEFAULT_GOOGLE_WEB_CLIENT_ID = '280253430618-u9ihi8rabga9buc3hoicbeaehguiasdt.apps.googleusercontent.com';
const DEFAULT_GOOGLE_ANDROID_DEBUG_CLIENT_ID = '280253430618-tfe8d05h9ge10c5oitlbkh1upfbu8j6r.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID = '280253430618-66bopqe6ob2jj555d764mmmodr3thssr.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.280253430618-66bopqe6ob2jj555d764mmmodr3thssr';

/**
 * Local Android builds in this repo use `android/app/debug.keystore`, which maps to the
 * debug client ID above. EAS builds should inject `EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID`
 * so Google Sign-In uses the client registered for the EAS signing certificate instead.
 */
export const GOOGLE_AUTH_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_ANDROID_DEBUG_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || DEFAULT_GOOGLE_IOS_CLIENT_ID,
  iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || DEFAULT_GOOGLE_IOS_URL_SCHEME,
};
