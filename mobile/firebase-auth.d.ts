import type { Persistence } from '@firebase/auth';

/**
 * The RN build of Auth exports this; the default `firebase/auth` .d.ts targets web.
 * Metro still resolves the correct implementation at runtime.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: import('@react-native-async-storage/async-storage').default,
  ): Persistence;
}
