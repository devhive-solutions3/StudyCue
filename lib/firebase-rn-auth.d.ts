declare module '@firebase/auth/dist/rn/index.js' {
  export * from 'firebase/auth';
  import type { Persistence } from 'firebase/auth';
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
    removeItem(key: string): Promise<unknown>;
  }): Persistence;
}
