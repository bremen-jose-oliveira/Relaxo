import * as Crypto from 'expo-crypto';

/** Cross-platform UUID v4 (works on iOS/Android/web; unlike the `uuid` npm package). */
export function newId(): string {
  return Crypto.randomUUID();
}
