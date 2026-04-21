import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: import('@firebase/auth').ReactNativeAsyncStorage
  ): import('@firebase/auth').Persistence;
}
