// Déclaration ambient minimaliste pour `expo-screen-capture` afin que tsc
// passe avant qu'un `npm install` n'ait apporté les vraies définitions.
// Une fois le package installé, sa propre `index.d.ts` prend le dessus
// (priorité aux fichiers `node_modules/.../*.d.ts`).
declare module 'expo-screen-capture' {
  export function preventScreenCaptureAsync(key?: string): Promise<void>;
  export function allowScreenCaptureAsync(key?: string): Promise<void>;
  export function addScreenshotListener(listener: () => void): { remove: () => void };
}
