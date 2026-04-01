// utils/environmentInfo.ts
// Helper to determine which Firebase project and environment the app is using

export const getEnvironmentInfo = () => {
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'production';
  const firebaseProjectId = process.env.EXPO_PUBLIC_DEV_FIREBASE_PROJECT_ID === 'TODO_DEV_PROJECT_ID'
    ? process.env.EXPO_PUBLIC_PROD_FIREBASE_PROJECT_ID || 'local-list-wski21'
    : env === 'development'
    ? process.env.EXPO_PUBLIC_DEV_FIREBASE_PROJECT_ID
    : process.env.EXPO_PUBLIC_PROD_FIREBASE_PROJECT_ID || 'local-list-wski21';

  return {
    environment: env,
    firebaseProjectId,
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    isPreview: env === 'preview'
  };
};

/**
 * Log environment info on app start (dev only)
 * Useful for debugging which Firebase project is connected
 */
export const logEnvironmentInfo = () => {
  if (__DEV__) {
    const info = getEnvironmentInfo();
    console.log(
      `🔥 Firebase Environment:\n` +
      `   Environment: ${info.environment}\n` +
      `   Project ID: ${info.firebaseProjectId}\n` +
      `   Connected to: ${info.isDevelopment ? '🧪 Development' : info.isProduction ? '🚀 Production' : '🟡 Preview'}`
    );
  }
};

/**
 * Show environment banner on startup (development only)
 * Prevents accidental production actions in dev builds
 */
export const showEnvironmentBanner = () => {
  if (__DEV__) {
    const info = getEnvironmentInfo();
    if (info.isDevelopment) {
      const projectDisplay = info.firebaseProjectId || 'unknown';
      console.warn(
        `\n` +
        `╔════════════════════════════════════════════╗\n` +
        `║  🧪 DEVELOPMENT ENVIRONMENT 🧪           ║\n` +
        `║  Using: ${projectDisplay.padEnd(30)} ║\n` +
        `║  Data is isolated from production        ║\n` +
        `╚════════════════════════════════════════════╝\n`
      );
    }
  }
};
